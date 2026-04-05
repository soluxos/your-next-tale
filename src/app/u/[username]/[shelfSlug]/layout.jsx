// ShelfView is rendered by ProfileLayout (u/[username] level) so it persists
// across shelf tab navigations. This layout just passes children and the @modal slot.
export default function ShelfLayout({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
