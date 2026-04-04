---
applyTo: "**"
---

## Profile Avatars — Always use FacehashAvatar

This project uses **Facehash** (generative face illustrations) for all user profile pictures — there are no uploaded photo avatars.

### Rule

Whenever you render a user's profile picture, **always** use the `FacehashAvatar` component:

```jsx
import FacehashAvatar from "@/components/profile/FacehashAvatar";

<FacehashAvatar
  name={user.full_name || user.username}
  color={user.facehash_color}
  size={32}
/>;
```

### Props

| Prop        | Type     | Default       | Description                                                                                                            |
| ----------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `name`      | `string` | `"user"`      | Full name or username — drives the face generation                                                                     |
| `color`     | `string` | rainbow cycle | `facehash_color` from the user's profile row (oklch string)                                                            |
| `size`      | `number` | `32`          | Pixel size. Common values: `28` (inline), `32` (feed/lists), `40` (user lists), `48` (settings), `64` (profile header) |
| `className` | `string` | `""`          | Extra CSS classes if needed                                                                                            |

### Data requirements

Any Supabase query that fetches a profile for display purposes **must** include `facehash_color`:

```js
.select('id, username, full_name, facehash_color, ...')
```

### Never do this

- Do **not** render `<img src={avatarUrl} />` for profile pictures
- Do **not** render initials-in-a-circle as a fallback
- Do **not** use the raw `<Facehash>` component from `facehash` directly — use `FacehashAvatar` instead
- Do **not** omit `facehash_color` from profile queries when the result will be displayed
