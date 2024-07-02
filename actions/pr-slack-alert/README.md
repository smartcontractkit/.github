# pr-slack-alert

> Send Slack alert to a specific user group in a channel from Github PRs

## Usage

```
name: PR Workflow

on:
  pull_request:

jobs:
  pr-ci-checks:
    runs-on: ubuntu-latest
    env:
      SLACK_CHANNEL_ID: 7777777777
      SLACK_USER_GROUP_ID: 7777777777
    steps:
      - name: Do stuff
      - name: Do stuff
      - ...
      - name: Slack Alert
        uses: smartcontractkit/.github/actions/pr-slack-alert@{sha-tag} # pr-slack-alert@0.1.0
        with:
          slack-channel-id: ${{ env.SLACK_CHANNEL_ID }}
          slack-user-group-id: ${{ env.SLACK_USER_GROUP_ID }}
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }} # requires `chat:write` permission
          pr-event-type: "opened"
```

## Future Work

We could update the `payload.json` to generate the message based on the event
type.
