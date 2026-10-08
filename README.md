# tomasplsek.github.io

Personal website, styled as a text editor. GitHub Pages builds it with Jekyll on every push to `main`.

## Editing content

| What | Where |
| --- | --- |
| Bio (name + intro paragraphs) | `_includes/about-intro.md` |
| Education, work, CV link | `_includes/about-cv.md` |
| Publications | `_data/papers.yml` (one entry per paper) |
| Projects | `_includes/projects.md` |
| Site title, description, ADS link | `_config.yml` |
| Photo, figures, PDFs, fonts | `files/` |

The markdown is rendered at build time, and the same text is shown as source by the `</>` button (or `Ctrl+Shift+V`).

## Local preview

Build with GitHub's own Pages builder image (same Jekyll version as production), then serve `_site/`:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/github/workspace -w /github/workspace \
  -e HOME=/tmp -e GITHUB_WORKSPACE=/github/workspace -e GITHUB_REPOSITORY=tomasplsek/tomasplsek.github.io \
  -e INPUT_SOURCE=./ -e INPUT_DESTINATION=./_site -e INPUT_FUTURE=false \
  -e INPUT_BUILD_REVISION=local -e INPUT_VERBOSE=false -e INPUT_TOKEN= \
  ghcr.io/actions/jekyll-build-pages:v1.0.13
python3 -m http.server 4000 --directory _site   # → http://localhost:4000
```

## Keyboard shortcuts

`Ctrl+P` go to file · `Ctrl+Shift+P` / `F1` commands · `Ctrl+Shift+V` source/preview · `Ctrl+B` explorer · ✕ plays Pong (`Esc` quits)
