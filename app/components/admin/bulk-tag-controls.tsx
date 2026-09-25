/** The tag field and its Add and Remove submits, for a bulk bar inside the selection's form. */
export function BulkTagControls({ listId, options }: { listId: string; options: string[] }) {
  return (
    <>
      <label className="posts-bulk-tag">
        <span>Tag</span>
        <input type="text" name="tag" list={listId} autoComplete="off" placeholder="tag name" />
      </label>
      <datalist id={listId}>
        {options.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <button type="submit" name="intent" value="bulk-add-tag" className="btn">
        Add tag
      </button>
      <button type="submit" name="intent" value="bulk-remove-tag" className="btn">
        Remove tag
      </button>
    </>
  );
}
