# Change Log

All notable changes to the "Denodo VQL" extension will be documented in this file.

## [1.0.1] - Public Release
### Changed
- Updated README, screenshots, and documentation specifically for the public VS Code Marketplace release.
- Streamlined the build process and bundled dependencies to drastically reduce the extension file size for faster installation.
- Complete audit of VQL commands, syntax, and functions.

## [1.0.0] - Initial Release
### Added
- **Denodo 9 VQL Syntax Highlighting:** Comprehensive syntax coloring for `*.vql` files.
- **Advanced Function Support:** Native highlighting for Denodo 9 AI & Embedding functions (`EMBED_AI`, `CLASSIFY_AI`), Spatial functions (`ST_GEOMETRYTYPE`), Text, Date, and Math functions.
- **Denodo Native Types:** Support for `TIMESTAMPTZ`, `INTERVALYEARMONTH`, `REGISTER`, `ARRAY`, and more.
- **Smart Deprecation Warnings:** Visually flags deprecated functions like `TO_DATE` to encourage modern VQL standards.
- **Language Configuration:** Added native support for VQL bracket matching, auto-closing quotes, and `Ctrl + /` toggling for Denodo-style `#` comments.
- **Standard SQL Fallback:** Integrated standard SQL highlighting for baseline keywords and syntax.
- **Community:** Added `CONTRIBUTING.md` and issue templates for community bug reports and feature requests.

### Maintenance
- Bootstrapped project using Yeoman extension generator.
- Migrated package management to `pnpm` with a strict lockfile.
- Built automated CI/CD pipeline with a tagged release model for `.vsix` generation.