import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Enable GA only when explicitly requested in production builds
const isProd = process.env.NODE_ENV === 'production';
const enableGtag = isProd && process.env.GA_ENABLED === 'true';

const config: Config = {
  title: 'AIExplorerHub',
  tagline: 'AI正在重构人类的思维与工作方式。我们关注如何通过实践验证、从日常细节入手，建立面向未来的思维与行为模式。',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://www.wealthhub.wiki',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'facebook', // Usually your GitHub org/user name.
  projectName: 'docusaurus', // Usually your repo name.

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/_hidden-docs',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'daily',
          priority: 0.5,
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  // Themes (register local search as a theme so it provides SearchBar/SearchPage)
  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */ (
        {
          hashed: true,
          docsRouteBasePath: '/_hidden-docs',
          highlightSearchTermsOnTargetPage: true,
          language: ['zh', 'en'],
        }
      ),
    ],
  ],

  // Plugins（仅在生产环境且设置 GA_ENABLED=true 时启用 gtag）
  plugins: [
    ...(enableGtag
      ? [
          [
            require.resolve('@docusaurus/plugin-google-gtag'),
            {
              trackingID: 'G-4JEYTCB9ES',
              anonymizeIP: true,
            },
          ],
        ]
      : []),
  ],

  // Load client modules (run in browser)
  clientModules: ['./src/clientModules/gaHiddenBodyInjection.ts'],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true, // 在侧边栏底部显示可收缩按钮
        autoCollapseCategories: true,
      },
    },
    navbar: {
      title: 'AIExplorerHub',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/_hidden-docs/agent/core-terms', label: 'Agent', position: 'left'},
        {to: '/_hidden-docs/claude-code/basic', label: 'Claude Code', position: 'left'},
        {to: '/_hidden-docs/shuji/reading-guide', label: 'Books', position: 'left'},
        {to: '/newsletter', label: 'Newsletter', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {type: 'search', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/facebook/docusaurus',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} WealthHub. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
