/**
 * Root — Docusaurus 的根组件包装（每个页面都会经过这里）。
 *
 * 源码站用它做「全站唯一挂载点」：把 ChatWidget 挂上去，它就出现在所有页面。
 * 参考：https://docusaurus.io/docs/swizzling#wrapper-your-site-with-root
 */

import React from 'react';
import ChatWidget from '@site/src/components/ChatWidget';

export default function Root({children}: {children: React.ReactNode}) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
