#!/bin/bash

# Read all input from standard input
input=$(cat)

log_output=$(echo $input | jq -Rs . | sed 's/^"//;s/"$//' | sed -e 's/\\ No newline at end of file//g' | sed -E 's/\\+$//g' )
analyze_prompt="
You are a helpful expert data engineer with expertise in Blockchain and Decentralized Oracle Networks and software development. Your task is to analyze log records of a Github Action run and find plausible cause for error(s) that caused the run to fail. You will focus only on error logs.

Given logs below tell me the following:
1. Organize the errors by issue in order of appearance. Focus only on errors. Ignore warnings. Title each error as a 1 <= 10 words sentence that describes the error.
  1.1 Show the source of errors in a single code block. You can remove parts of the logs that are very repetitive.
    1.1.1 Wrap the code block like this:
    ```
    # error logs here
    ```
  1.2 Write a **why**: a <= 100 words paragraph explaining what caused the error.
  1.3 Write a **Suggested fix**: <= 100 words paragraph suggesting the fix for specific the error, if any. Do not discuss anything unrelate to the errors found in #1.2.

do not include any another preamble and postamble/summaries of your answer. If there are no errors, write 'No errors found.'.
"

openai_prompt=$(echo $analyze_prompt | sed 's/"/\\"/g' | sed -E 's/\\+$//g' | sed -E 's/\\+ //g')
openai_model="gpt-4-turbo-2024-04-09"
openai_result=$(echo '{
    "model": "'$openai_model'",
    "temperature": 0.1,
    "messages": [
    {
        "role": "system",
        "content": "'$openai_prompt' \n\n```'$log_output'```"
    }
    ]
}' | envsubst | curl https://api.openai.com/v1/chat/completions \
                -w "%{http_code}" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $OPENAI_API_KEY" \
                -d @-
)

throw error openai_result when is not 200
if [ $(echo "$openai_result" | tail -n 1) != '200' ]; then
    echo "::error::OpenAI API call failed with status $openai_result: $(cat prompt_response.json)"
    exit 1
fi

# replace lines starting with ' -' (1space) with '  -' (2spaces)
response_content=$(echo "$openai_result" | sed '$d' | jq -r '.choices[0].message.content' | sed -e 's/^ -/  -/g')
echo -e "\033[1m\033[33m======= ANALYSIS OUTPUT =======\033[0m"
echo -e "\033[32m$response_content\033[0m"
