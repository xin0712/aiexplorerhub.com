import type {ReactNode} from 'react';
import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx(styles.heroRoot)}>
      <div className={clsx('container', styles.heroWrap)}>
        <div className={styles.heroLeft}>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/blog">
              进入博客
            </Link>
          </div>
        </div>
        <div className={styles.heroRight}>
          <img
            className={styles.heroImage}
            src="/img/hero/home-illustration.jpg"
            alt="WealthHub 首页插图"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </header>
  );
}

// 单图展示，无轮播

function ThreeColumns() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <h2 className={styles.sectionTitle}>基本介绍</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureItem}>
            <h3>一、关于本教程</h3>
            <p>本教程旨在系统探讨 AI 技术普及对个体思维方式、工作模式与生活习惯的长期影响。</p>
            <p>我们关注的，不是具体工具的使用技巧，而是这些工具背后所映射的认知模型与方法论变革。</p>
            <p>通过结构化的知识整理、案例研究与实践复盘，本教程希望帮助读者在智能化浪潮中构建可持续的思维体系与行动框架。</p>
          </div>
          <div className={styles.featureItem}>
            <h3>二、它不是什么</h3>
            
              <p>这不是一份“教你快速掌握AI工具”的操作指南。</p>
              <p>它不追求“爆款提示词”或“捷径技巧”，也不提供任何速成方案。</p>
              <p>它不以追逐新概念或热点为目标，而以理性、验证与长期价值为原则。</p>
              <p>本教程不鼓励被动消费AI成果，而强调主动理解技术逻辑与重构思维方式。</p>
            
          </div>
          <div className={styles.featureItem}>
            <h3>三、为什么写这份教程</h3>
            <p>AI技术正在以前所未有的速度渗透到生产与生活的每一个环节。</p>
            <p>但真正拉开差距的，不是“谁用的工具更多”，而是“谁能更早在实践中完成思维与习惯的重构”。</p>
            <p>我们希望通过这份教程，帮助读者从可操作的角度理解AI带来的结构性变革，</p>
            <p>在小处实践，在行动中反思，逐步形成适应智能时代的思维模型与知识体系。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <ThreeColumns />
      </main>
    </Layout>
  );
}
