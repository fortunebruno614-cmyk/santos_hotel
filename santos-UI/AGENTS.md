<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep hotel demonstration data in a shared local module; no backend or personal-data persistence is used in this prototype.
- Use a shared hotel shell, booking context and reusable presentation controls across file-based content routes so booking selections survive client navigation.
- Define all hospitality colors and visual roles in src/styles.css; route pages use semantic tokens.
