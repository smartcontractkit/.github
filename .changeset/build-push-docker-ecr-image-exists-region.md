---
"build-push-docker": patch
---

Pass `aws-region` to `ecr-image-exists` in the "Check for existing tags" step.
Without it the check used that action's default, `us-east-1`, so with
`allow-overwrites: "false"` a private repo in any other region failed with
`AccessDeniedException` on `ecr:DescribeImages` before the push.
