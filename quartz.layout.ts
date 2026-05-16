import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileTrieNode } from "./quartz/util/fileTrie"

const explorerSortFn = (a: FileTrieNode, b: FileTrieNode) => {
  if (a.isFolder && b.isFolder) {
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }
  if (a.isFolder) return -1
  if (b.isFolder) return 1
  const aDates = (a.data as any)?.dates
  const bDates = (b.data as any)?.dates
  const aDate = aDates?.created ?? aDates?.modified ?? aDates?.published
  const bDate = bDates?.created ?? bDates?.modified ?? bDates?.published
  if (aDate && bDate) {
    const at = new Date(aDate).getTime()
    const bt = new Date(bDate).getTime()
    if (bt !== at) return bt - at
  }
  return a.displayName.localeCompare(b.displayName, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.TopNav()],
  afterBody: [
    Component.ConditionalRender({
      component: Component.PostsByMonth({}),
      condition: (page) => page.fileData.slug === "posts",
    }),
  ],
  footer: Component.Footer({
    links: {
      소개: "/about",
      "전체 글": "/posts",
      카테고리: "/categories",
      연락처: "/contact",
      "개인정보처리방침": "/privacy-policy",
    },
  }),
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn }),
  ],
  right: [],
}
