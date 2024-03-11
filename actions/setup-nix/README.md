# setup-nix

`setup-nix` installs a nix environment and configures it with the specified caches

## Configuration

```yaml
inputs:
  # custom cache inputs ----------------------------------
  # these can point to any public or private cache
  cache-url: https://, s3://, etc
  cache-pubkey: corresponding cache key

  # AWS inputs ------------------------------------
  # enable to read/write for private caches hosted using s3 buckets
  # note: does not push to cache but environment is setup for pushing
  enable-aws: bool, true/false
  aws-region: credential location
  role-to-assume: credential
  role-duration-seconds: credential TTL
    
  # cachix inputs --------------------------------
  # enable to use private caches hosted on cachix
  # enable to push to caches hosted on cachix
  enable-cachix: bool, true/false
  cachix-name: cache name
  cachix-token: token for cachix account
```
