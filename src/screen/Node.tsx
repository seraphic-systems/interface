import { Fragment, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parse, stringify } from "yaml";

export type Frontmatter = Record<string, unknown>;

export interface NodeProps {
  /** Markdown with an optional leading YAML block enclosed by --- lines. */
  content: string;
  className?: string;
  components?: Components;
  /** Override the metadata display; return null to hide it. */
  renderFrontmatter?: (frontmatter: Frontmatter) => ReactNode;
}

export function parseMarkdown(content: string): {
  frontmatter: Frontmatter;
  body: string;
  error?: string;
} {
  const source = content.replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/);

  if (!/^---[\t ]*$/.test(lines[0] ?? "")) {
    return { frontmatter: {}, body: source };
  }

  const end = lines.findIndex(
    (line, index) => index > 0 && /^(?:---|\.\.\.)[\t ]*$/.test(line),
  );

  // An unclosed block may simply be a Markdown horizontal rule.
  if (end === -1) return { frontmatter: {}, body: source };

  const body = lines.slice(end + 1).join("\n");

  try {
    const data: unknown = parse(lines.slice(1, end).join("\n"), {
      maxAliasCount: 0,
    });

    if (data == null) return { frontmatter: {}, body };
    if (typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Frontmatter must be a YAML mapping of keys to values.");
    }

    return { frontmatter: data as Frontmatter, body };
  } catch (error) {
    return {
      frontmatter: {},
      body,
      error: error instanceof Error ? error.message : "Invalid YAML frontmatter.",
    };
  }
}

function Metadata({ data }: { data: Frontmatter }) {
  return (
    <dl className="node-frontmatter">
      {Object.entries(data).map(([key, value]) => (
        <Fragment key={key}>
          <dt>{key}</dt>
          <dd>
            {value !== null && typeof value === "object" ? (
              <pre>{stringify(value).trimEnd()}</pre>
            ) : (
              String(value ?? "")
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Renders metadata above Markdown, with semantic HTML and optional overrides. */
export function Node({
  content,
  className,
  components,
  renderFrontmatter,
}: NodeProps) {
  const { frontmatter, body, error } = parseMarkdown(content);

  return (
    <article className={["node", className].filter(Boolean).join(" ")}>
      {error && (
        <pre className="node-frontmatter-error" role="alert">
          Invalid frontmatter: {error}
        </pre>
      )}
      {Object.keys(frontmatter).length > 0 && (
        <header>
          {renderFrontmatter ? (
            renderFrontmatter(frontmatter)
          ) : (
            <Metadata data={frontmatter} />
          )}
        </header>
      )}
      <div className="node-body">
        <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
          {body}
        </Markdown>
      </div>
    </article>
  );
}

export default Node;
