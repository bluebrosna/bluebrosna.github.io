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
          light: "#f5faff",
          lightgray: "#d9e9f7",
          gray: "#8fa8c1",
          darkgray: "#17324d",
          dark: "#0a1830",
          secondary: "#1769aa",
          tertiary: "#57a9eb",
          highlight: "rgba(23, 105, 170, 0.12)",
          textHighlight: "#bcdcff88",
        },
        darkMode: {
          light: "#09111e",
          lightgray: "#1c2b3f",
          gray: "#5e7b95",
          darkgray: "#d9e6f2",
          dark: "#f3f8ff",
          secondary: "#7ab6e8",
          tertiary: "#b1d8fb",
          highlight: "rgba(122, 182, 232, 0.14)",
          textHighlight: "#5da0ff66",
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
