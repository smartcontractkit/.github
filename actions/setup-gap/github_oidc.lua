- name: envoy.filters.http.lua
  typed_config:
    "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
    inline_code: |
      JSON = (loadfile "/etc/envoy/json.lua")() -- one-time load of the routines
      local jwt_expiration = 0
      local jwt_token = nil
      local refreshing = false
      local request_options = {["asynchronous"] = true}
      local main_dns_zone = "${MAIN_DNS_ZONE}"

      -- Function to decode base64 value
      local function decode_base64(input)
        local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        input = input:gsub('[^' .. b .. '=]', '')

        return (input:gsub('.', function(x)
          if x == '=' then
            return ''
          end
          local r, f = '', (b:find(x) - 1)
          for i = 6, 1, -1 do
            r = r .. (f % 2 ^ i - f % 2 ^ (i - 1) > 0 and '1' or '0')
          end
          return r
        end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
          if #x ~= 8 then
            return ''
          end
          local c = 0
          for i = 1, 8 do
            c = c + (x:sub(i, i) == '1' and 2 ^ (8 - i) or 0)
          end
          return string.char(c)
        end))
      end

      -- Function to get JWT exp time from JWT token
      local function get_jwt_exp(jwt)
        -- Extract the three parts of the JWT: header, payload, and signature
        local header, payload, signature = jwt:match("([^%.]+)%.([^%.]+)%.([^%.]+)")
        if not (header and payload and signature) then
          return nil
        end

        -- Decode the payload from Base64
        local decoded_payload = decode_base64(payload)
        if not decoded_payload then
          return nil
        end

        -- Parse the decoded payload as JSON
        local decoded_json = JSON.decode(decoded_payload)
        if not decoded_json or not decoded_json.exp then
          return nil
        end

        return decoded_json.exp
      end

      -- Function to fetch GitHub OIDC token
      function fetch_github_oidc_token(request_handle)
        if refreshing then
          return -- Prevent multiple concurrent refreshes
        end
        refreshing = true

        -- Set the audience and the GitHub OIDC token URL
        local audience = "gap"
        local oidc_url = "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=" .. audience

        -- Prepare headers
        local headers = {
          [":method"] = "GET",
          [":path"] = oidc_url,
          [":authority"] = "${GITHUB_OIDC_HOSTNAME}",
          ["Authorization"] = "Bearer " .. "${ACTIONS_ID_TOKEN_REQUEST_TOKEN}", -- Use environment variable
          ["accept"] = "application/json",
        }

        -- Make the HTTP call
        local response_headers, response_body = request_handle:httpCall(
          "github_oidc_endpoint",
          headers,
          nil, -- No body for GET requests
          3000 -- Timeout in milliseconds
        )

        if response_headers[":status"] == "200" then
          request_handle:logInfo("dynamic-proxy: GitHub OIDC token fetched successfully.")
          local data = JSON.decode(response_body)
          jwt_token = data.value -- Assign the token value
          jwt_expiration = get_jwt_exp(jwt_token)
        else
          request_handle:logErr("dynamic-proxy: Failed to fetch GitHub OIDC token. Status: " .. response_headers[":status"])
        end

        refreshing = false
      end

      -- Function to refresh the token if needed
      function refresh_token_if_needed(request_handle)
        local current_time = os.time()
        if not jwt_token or jwt_expiration - current_time < 60 then
          fetch_github_oidc_token(request_handle)
        end
      end

      -- Main function for Envoy request interception
      function envoy_on_request(request_handle)
        refresh_token_if_needed(request_handle)
        local host = request_handle:headers():get(":authority")
        if jwt_token and host:match(main_dns_zone .. "$") then
          -- Remove the existing header if it already exists
          request_handle:headers():remove("${GITHUB_OIDC_TOKEN_HEADER_NAME}")
          request_handle:headers():add("${GITHUB_OIDC_TOKEN_HEADER_NAME}", "Bearer " .. jwt_token)
          request_handle:logInfo("dynamic-proxy: GitHub JWT OIDC token added successfully to the header: ${GITHUB_OIDC_TOKEN_HEADER_NAME}.")
        else
          -- Log info if host does not match or jwt_token is not available
          request_handle:logInfo("dynamic-proxy: Host does not match DNS zone or JWT token is not available. Skipping JWT addition.")
        end
        -- Used to match with correct Route, ex: smartcontractkit/repo-name-here
        if not request_handle:headers():get("x-repository") then
          request_handle:headers():add("x-repository", "${GITHUB_REPOSITORY}")
        else
          request_handle:logInfo("Skipping addition of 'x-repository' header as it is already present")
        end
      end
