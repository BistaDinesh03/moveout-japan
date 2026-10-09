'use strict';

/**
 * Blog integrity gate.
 *
 * Background: the site previously advertised 10 articles. Only one had ever
 * existed; seven linked to files that were never created and two were 0-byte
 * placeholders that rendered as blank white pages. This suite fails if that
 * ever regresses — every advertised slug must map to a real, non-empty
 * article, and no published file may be empty.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const MAIN = path.join(ROOT, 'assets', 'js', 'main.js');
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');

/** Extract BLOG_POSTS from main.js without executing the rest of the file
 *  (main.js needs a browser `document`, so it cannot simply be required). */
function readBlogPosts() {
  const src = fs.readFileSync(MAIN, 'utf8');
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

test('BLOG_POSTS parses and is not empty', () => {
  const posts = readBlogPosts();
  assert.ok(Array.isArray(posts));
  assert.ok(posts.length >= 1, 'at least one published article is expected');
});

test('every advertised slug has a real, non-empty article file', () => {
  const posts = readBlogPosts();
  for (const post of posts) {
    const file = path.join(POSTS_DIR, `${post.slug}.html`);
    assert.ok(fs.existsSync(file), `missing article file for slug "${post.slug}"`);

    const size = fs.statSync(file).size;
    assert.ok(size > 0, `${post.slug}.html is 0 bytes — a blank page would be published`);

    // A meaningful article, not another placeholder.
    assert.ok(size > 2000, `${post.slug}.html is only ${size} bytes — too small to be an article`);
  }
});

test('every published article file is actually advertised', () => {
  const posts = readBlogPosts();
  const slugs = new Set(posts.map((p) => p.slug));

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.html'));
  assert.ok(files.length > 0, 'expected at least one article file');
  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    assert.ok(slugs.has(slug), `article file ${f} exists but is not listed in BLOG_POSTS`);
  }
});

test('no zero-byte files anywhere in the published site', () => {
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  };

  const empty = walk(ROOT).filter((f) => fs.statSync(f).size === 0);
  assert.deepEqual(
    empty.map((f) => path.relative(ROOT, f)),
    [],
    'zero-byte files get published as blank pages'
  );
});

test('post entries have the fields the UI depends on', () => {
  const posts = readBlogPosts();
  const required = ['slug', 'title', 'excerpt', 'category', 'date'];
  const seen = new Set();

  for (const post of posts) {
    for (const field of required) {
      assert.ok(
        typeof post[field] === 'string' && post[field].length > 0,
        `post ${post.slug || '?'} is missing "${field}"`
      );
    }
    assert.ok(!seen.has(post.slug), `duplicate slug: ${post.slug}`);
    seen.add(post.slug);

    assert.match(post.slug, /^[a-z0-9-]+$/, `slug must be URL-safe: ${post.slug}`);
    assert.match(post.date, /^\d{4}-\d{2}-\d{2}$/, `date must be ISO: ${post.date}`);
    assert.ok(
      new Date(post.date).getTime() <= Date.now(),
      `post ${post.slug} is dated in the future`
    );
  }
});

test('post image references point at files that exist', () => {
  const posts = readBlogPosts();
  for (const post of posts) {
    if (!post.image) continue;
    assert.ok(post.image.startsWith('/'), `image must be site-absolute: ${post.image}`);
    const file = path.join(ROOT, post.image.slice(1));
    assert.ok(fs.existsSync(file), `image not found: ${post.image}`);
    assert.ok(fs.statSync(file).size > 0, `image is empty: ${post.image}`);
  }
});
