import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "블루의 블로그",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    locale: "ko-KR",
    baseUrl: "bluebrosna.github.io",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Noto Serif KR",
        body: "Noto Sans KR",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#f6efe6",
          lightgray: "#e1d6c8",
          gray: "#93a1b2",
          darkgray: "#334155",
          dark: "#15202b",
          secondary: "#1f4b73",
          tertiary: "#7c9db6",
          highlight: "rgba(31, 75, 115, 0.12)",
          textHighlight: "#f1c45388",
        },
        darkMode: {
          light: "#0e1620",
          lightgray: "#223141",
          gray: "#5d748a",
          darkgray: "#dbe4ee",
          dark: "#f7f8fa",
          secondary: "#7cb1d8",
          tertiary: "#6b8aa0",
          highlight: "rgba(124, 177, 216, 0.12)",
          textHighlight: "#f1c45388",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
