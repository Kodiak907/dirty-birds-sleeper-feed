# FFO GameCast Stadium: compact-file preview upload trigger

Stage-only Cloudflare build trigger for the immutable PFO preview commit `6cbc068ec558ace72f9fd748ebaeadbec71cb37c`, via `ci_pages_stadium_http.mjs`. This script downloads the seven necessary PFO files instead of running a full Git fetch, which failed with curl 56/early EOF. Target `dirtybirdstest` Pages PREVIEW only, branch `pfo-thursday-staging`, never production/main. Restore Worker build command to None when build completes or fails.
