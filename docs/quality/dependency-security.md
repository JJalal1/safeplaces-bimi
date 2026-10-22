# Dependency security review

The October 2026 audit covers both the application and development dependency graph. Build-time labels alone do not establish runtime safety: React Server Components and the vinext runtime are installed as development dependencies and are included in the deployed Worker. The full audit therefore gates releases at high severity, alongside the application's regression tests.

Reviewed updates include matching React/React DOM/RSC 19.2.8, Next.js 16.4.1, Vite 8.1.6, sharp 0.35.5 and the explicit transitive fixes recorded in `website/pnpm-workspace.yaml`. The existing seven-day release-age policy remains enabled. Frozen installation uses the regenerated lockfile and applies the committed patch before validation.

## Locally mitigated advisory

GHSA-vfj7-8cjw-p6xm affects `braces@3.0.3`; no upstream fixed release was listed at review time. `website/patches/braces@3.0.3.patch` caps parser nesting, including parenthesis nodes, and validates AST depth iteratively before compile, expand and stringify walkers run. It also bounds the number of visited AST nodes. Direct AST inputs and string inputs are both covered.

`website/scripts/check-build-dependencies.mjs` exercises normal brace expansion, 20,000-level nested brace and parenthesis strings, 1,000-level direct AST inputs, and normal glob matching across the installed minimatch versions. The production and browser test suites run with the patched dependency graph.

The single advisory ID is excluded from the package-version audit only because the version scanner cannot recognise a local patch. This is a documented mitigation, not an upstream fixed package or an assertion that no advisory ever existed. Do not remove the patch while retaining the audit exception. Replace both with the upstream fix when a suitable release becomes available. Keep all other advisory checks enabled.

Public sources:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-wx67-qw84-cm4g
- https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22
- https://github.com/advisories/GHSA-wq5f-xc86-pv6w

A clean package audit is evidence about published advisories and this dependency graph. It is not a guarantee that software contains no unknown vulnerabilities.
