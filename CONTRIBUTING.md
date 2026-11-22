# Contributing a template

Thanks for sharing a template. A pull request adds **one template file** and nothing else.

## The file

- Put it in `templates/`, named `<your-github-handle>-<template-name>.ctrlyoke.yaml`, for
  example `octocat-review-branch.ctrlyoke.yaml`. Use lowercase letters, digits and hyphens
  only. The name becomes the template's id and the file name ctrlyoke installs it under, so it
  cannot be changed after it is merged.
- Write it as a ctrlyoke workflow template: a workflow file with a `_templateMeta` block. See
  [Templates](https://ctrlyoke.dev/docs/workflows/templates) in the ctrlyoke docs, and start
  from ctrlyoke's **Template Starter** if you want an example of every variable type.
- `_templateMeta.name` and `_templateMeta.description` are required. Once ctrlyoke's latest
  release supports them, `_templateMeta.author` (your GitHub handle) and `_templateMeta.tags`
  (a few short keywords) are welcome too; the check below tells you if they are not supported
  yet.
- Make it useful beyond your own project: put project-specific values (test commands, paths,
  branch names) in `{variables}` with sensible defaults.

## What a reviewer looks for

- **It is safe.** Condition scripts and script steps run on the user's machine. No downloads
  piped into a shell, no reading credentials, no sending data anywhere, no destructive commands,
  and no turning off a harness's permission prompts. The check flags lines like these for a
  closer look.
- **It works.** You have run it with ctrlyoke at least once.
- **It is yours to share.** You wrote it, or you have the right to submit it under MIT-0. Do not
  paste in material from another project, a harness's own documentation, or anywhere else whose
  license does not allow it.

## Checks

Every pull request runs `npm run check`, which:

1. Validates each template against the workflow schema of the **latest ctrlyoke release**,
   strictly: a field that release does not know fails.
2. Checks the file name and the required `_templateMeta` fields.
3. Checks that `index.json` matches `templates/`.

Run it locally before you push:

```sh
npm ci
npm run index   # regenerate index.json after adding or editing a template
npm run check
```

Commit the regenerated `index.json` with your template.

## License

By opening a pull request, you license your contribution under [MIT-0](LICENSE). You keep the
copyright in what you wrote. Anyone may copy, change and share it without credit.
