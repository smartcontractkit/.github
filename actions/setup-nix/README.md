# Setup Nix Action

`setup-nix` installs a nix environment using the
https://github.com/DeterminateSystems/nix-installer-action

## Inputs

### install-url (optional)

- **Description**: Custom URL for the Nix installer.
- **Required**: No
- **Default**: (If not provided, the action will use the default
  DeterminateSystems installer).
- **Usage**: If you need to install Nix using a different installer URL, provide
  it through this input.

### extra-conf (optional)

- **Description**: Additional Nix configuration options.
- **Required**: No
- **Default**: ""
- **Usage**: Use this input to provide extra configuration options that will be
  appended to /etc/nix/nix.conf.

- ## Usage

```yaml
jobs:
  setup_nix:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nix
        uses: smartcontractkit/.github/actions/setup-nix@7a7de5813c702b2e9d042903a1e9cffd2c0b40c5 # make sure to use the latest commit hash for version
        with:
          extra-conf: |
            sandbox = relaxed
```
