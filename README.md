# ctrlyoke community templates

Workflow templates for [ctrlyoke](https://ctrlyoke.dev), shared by the people who use it.
Each one is a single `.ctrlyoke.yaml` file in [`templates/`](templates/), reviewed in a pull
request and checked against ctrlyoke's workflow schema before it is listed.

## Installing a template

In ctrlyoke, open **Settings → Templates** and choose **Discover** in the page bar. Pick the
**User** or **Workspace** scope in the drawer's title bar, then choose **Install** on a
template. It is copied into `~/.ctrlyoke/templates/` or `.ctrlyoke/templates/` and shows up in
**New Workflow** straight away. See
[Community templates](https://ctrlyoke.dev/docs/workflows/templates#community-templates) in the
ctrlyoke docs.

You can also copy a file from `templates/` into either folder by hand.

## Review before you run

These templates are written by third parties. A template can run shell commands (in condition
scripts and script steps) and can ask an AI harness to change your files. Read a template
before you run a workflow made from it. Every template here was reviewed before it was
merged, but review is not a guarantee.

If a template is broken or looks malicious,
[report it](https://github.com/FuzzyNova/ctrlyoke-templates/issues/new?template=report-template.yml).

## Sharing a template

Open a pull request that adds one file. [`CONTRIBUTING.md`](CONTRIBUTING.md) describes the
rules and the checks it must pass.

## License

Everything in this repository is licensed under [MIT-0](LICENSE) (MIT No Attribution): you may
copy, change and share any template, in any project, without credit. Each contributor keeps the
copyright in the templates they wrote and licenses them under MIT-0 by submitting them.

ctrlyoke itself is not part of this repository and is licensed separately.

`index.json` is generated from `templates/` by `npm run index`; never edit it by hand.
