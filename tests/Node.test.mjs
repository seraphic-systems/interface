import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Node, { parseMarkdown } from "../dist/screen/Node.js";

const render = (content, props = {}) =>
  renderToStaticMarkup(createElement(Node, { content, ...props }));

test("renders YAML metadata before the Markdown body", () => {
  const html = render("---\ntitle: Hello\npublic: false\ncount: 0\ntags: [one, two]\n---\n# Body");
  assert.match(html, /<dt>title<\/dt><dd>Hello<\/dd>/);
  assert.match(html, /<dd>false<\/dd>/);
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /<pre>- one\n- two<\/pre>/);
  assert.ok(html.indexOf("</header>") < html.indexOf("<h1>Body</h1>"));
});

test("renders GFM tables, tasks, links, and fenced code", () => {
  const html = render("| Name |\n| --- |\n| Example |\n\n- [x] Done\n\n[Link](https://example.com)\n\n```js\nconst x = 1;\n```");
  assert.match(html, /<table>/);
  assert.match(html, /type="checkbox"[^>]*checked/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /<code class="language-js">const x = 1;/);
  assert.doesNotMatch(html, /<header>/);
});

test("handles BOM, CRLF, empty metadata, and YAML end markers", () => {
  assert.deepEqual(parseMarkdown("\uFEFF---\r\ntitle: Hello\r\n...\r\n# Body"), {
    frontmatter: { title: "Hello" }, body: "# Body",
  });
  assert.deepEqual(parseMarkdown("---\n---\nBody"), { frontmatter: {}, body: "Body" });
  assert.match(render(""), /class="node-body"/);
});

test("leaves horizontal rules and unclosed frontmatter as Markdown", () => {
  assert.equal(parseMarkdown("---\n# Heading").body, "---\n# Heading");
  assert.equal(parseMarkdown("# Heading\n\n---\nBody").frontmatter.title, undefined);
  assert.match(render("---\n# Heading"), /<hr\/>/);
});

test("reports malformed YAML and non-mappings while retaining the body", () => {
  for (const yaml of ["title: [", "- item", "a: 1\na: 2", "a: &a [*a]"]) {
    const html = render(`---\n${yaml}\n---\n# Still here`);
    assert.match(html, /role="alert"/);
    assert.match(html, /<h1>Still here<\/h1>/);
  }
});

test("supports custom metadata, hidden metadata, and custom Markdown elements", () => {
  const content = "---\ntitle: Hello\n---\n# Body";
  const html = render(content, {
    className: "custom",
    renderFrontmatter: (data) => createElement("h2", null, data.title),
    components: { h1: ({ children }) => createElement("h3", null, children) },
  });
  assert.match(html, /class="node custom"/);
  assert.match(html, /<h2>Hello<\/h2>/);
  assert.match(html, /<h3>Body<\/h3>/);
  assert.doesNotMatch(render(content, { renderFrontmatter: () => null }), /Hello/);
});

test("does not execute raw HTML or unsafe link schemes", () => {
  const html = render('---\ntitle: "<script>alert(1)</script>"\n---\n<script>alert(2)</script>\n\n[bad](javascript:alert)');
  assert.doesNotMatch(html, /<script>|javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
