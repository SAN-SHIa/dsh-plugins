export function createFeature(require) {
    const React = require('react');
    function fileTarget(raw) {
      if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:|dsh-session:)/i.test(raw)) return null;
      try {
        // DSH now uses resource addresses rather than plain file hrefs.
        if (/^dsh-resource:\/\/file\//i.test(raw)) {
          const url = new URL(raw);
          const match = url.pathname.match(/^\/session\/[^/]+\/(.*)$/);
          return match ? decodeURIComponent(match[1]) + url.hash : null;
        }
        if (/^file:/i.test(raw)) return decodeURIComponent(new URL(raw).pathname);
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[A-Z]:[\\/]/i.test(raw)) return null;
        return decodeURIComponent(raw);
      } catch { return raw; }
    }
    function targetOf(target) {
      const element = target instanceof Element ? target : target?.parentElement;
      return element?.closest('a[href], [data-file-path], [data-path], [data-resource-address], [title]');
    }
    const pathAttributes = ['data-file-path', 'data-path', 'data-resource-address', 'href'];
    function pathOf(element) {
      if (!element) return null;
      for (const attribute of pathAttributes) {
        const path = fileTarget(element.getAttribute(attribute));
        if (path) return path;
      }
      const title = element.getAttribute('title');
      return title && /^(?:\/|~\/|[A-Z]:[\\/]|file:|dsh-resource:\/\/file\/)/i.test(title) ? fileTarget(title) : null;
    }
    function FilePathTooltip() {
      const [tip, setTip] = React.useState(null);
      React.useEffect(() => {
        let active = null, timer = null;
        const reset = () => {
          if (!active) return;
          active = null;
          document.removeEventListener('scroll', clear, true);
          if (timer !== null) clearTimeout(timer);
          timer = null;
        };
        const clear = () => {
          if (!active) return;
          const visible = timer === null;
          reset();
          if (visible) setTip(null);
        };
        const over = (event) => {
          const candidate = targetOf(event.target);
          if (candidate === active) return;
          clear();
          const path = pathOf(candidate);
          if (!path) return;
          active = candidate;
          // Scrolling only matters while a tooltip is pending or visible.
          document.addEventListener('scroll', clear, {capture:true, passive:true});
          const x = event.clientX ?? 16, y = event.clientY ?? 16;
          timer = setTimeout(() => {
            timer = null;
            if (!candidate.isConnected) { reset(); return; }
            const left = Math.max(8, Math.min(x, window.innerWidth - 608));
            const top = y > window.innerHeight - 100 ? Math.max(8, y - 80) : y + 20;
            setTip({path, left, top});
          }, 100);
        };
        const out = (event) => {
          if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) clear();
        };
        const key = e => { if(e.key === 'Escape') clear(); };
        document.addEventListener('pointerover', over, true);
        document.addEventListener('pointerout', out);
        document.addEventListener('pointerdown', clear);
        document.addEventListener('keydown', key);
        window.addEventListener('blur', clear);
        return () => {
          reset();
          document.removeEventListener('pointerover', over, true);
          document.removeEventListener('pointerout', out);
          document.removeEventListener('pointerdown', clear);
          document.removeEventListener('keydown', key);
          window.removeEventListener('blur', clear);
        };
      }, []);
      if (!tip) return null;
      return React.createElement('div', {role:'tooltip', style:{
        position:'fixed', left:tip.left, top:tip.top,
        zIndex:2147483647, pointerEvents:'none', maxWidth:'min(600px, calc(100vw - 32px))',
        padding:'8px 12px', borderRadius:6, overflowWrap:'anywhere', whiteSpace:'pre-wrap',
        background:'var(--dsw-alias-bg-overlay)',color:'var(--dsw-alias-label-primary)',
        border:'1px solid var(--dsw-alias-border-l2)',font:'12px/1.5 Monaco, monospace'
      }}, tip.path);
    }
    return {inject:['slots'], apply(ctx) {
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({name:'shell.overlay',id:'local-file-path-tooltip',order:1000},FilePathTooltip));
    }};
}
