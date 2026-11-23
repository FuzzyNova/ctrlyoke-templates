# Contributing a template

Thanks for sharing a template. A pull request adds **one template file** and nothing else.

## The file

- Put it in `templates/`, named for what it does, such as `review-branch.ctrlyoke.yaml`. Use
  lowercase letters, digits and hyphens only (3 to 100 characters). The name becomes the
  template's id and the file name ctrlyoke installs it under, so it cannot be changed after it
  is merged. Names are first come, first served, and a name used by one of ctrlyoke's built-in
  templates (such as `fix-tests`) is not allowed. If the name you want is taken, pick a more
  specific one rather than adding your handle.
- Write it as a ctrlyoke workflow template: a workflow file with a `_templateMeta` block. See
  [Templates](https://ctrlyoke.dev/docs/workflows/templates) in the ctrlyoke docs, and start
  from ctrlyoke's **Template Starter** if you want an example of every variable type.
- Describe it in `_templateMeta`:

  ```yaml
  _templateMeta:
    name: Review Branch # required, at most 120 characters
    description: Review the current branch and fix what the review finds. # required, at most 500
    author: octocat # your GitHub handle
    tags: [review, git] # up to 10 lowercase keywords
  ```

  `name` and `description` are required. `author` and `tags` are optional but recommended:
  `author` is how the gallery credits you, and `tags` help people find the template. Reuse
  tags that other templates already have where they fit (see `index.json`).

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
2. Checks the file name and the `_templateMeta` fields described above.
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
