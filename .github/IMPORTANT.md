## .github Repository

The .github repository has some org-wide side-effects so we should be careful
about adding certain files.

For more information see
https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file#about-default-community-health-files

And to be specific, don't add the `pull_request_template.md` file to this
directory as it has broken some functionality regarding the `llm-pr-writer`
action.
