import { useState } from "react";
import { Form } from "react-router";
import { Button } from "capsomer/react/button";
import { SearchField } from "capsomer/react/field";

/**
 * The site search box: a plain GET to /search with the query in `q`, so it works with no script.
 * The search page, the 404 page and the blog list all render it. `children` sits inside the form after the input
 * row, for the search page's hidden filter fields and its operator hint. The `#q` id and the
 * `.search-form` class are what app/enhance/search.ts attaches to on the search page.
 */
export function SearchForm({
  defaultValue,
  label = "Search this site",
  labelHidden,
  placeholder = "Try: d1, tag:cloudflare, 2026, or a quoted phrase",
  children,
}: {
  defaultValue?: string;
  label?: string;
  labelHidden?: boolean;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <Form method="get" action="/search" className="search-form">
      <div className="search-input-row">
        <SearchField
          label={label}
          labelHidden={labelHidden}
          id="q"
          name="q"
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          autoComplete="off"
        />
        <Button type="submit" variant="primary">
          Search
        </Button>
      </div>
      {children}
    </Form>
  );
}
