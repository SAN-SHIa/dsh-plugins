export function createFeature(require) {
    const React = require('react');
    function fileTarget(raw) {
      if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:|dsh-session:)/i.test(raw)) return null;
      try {
        if (/^file:/i.test(raw)) return decodeURIComponent(new URL(raw).pathname);
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[A-Z]:[\\/]/i.test(raw)) return null;
        return decodeURIComponent(raw);
      } catch { return raw; }
    }
    function FilePathTooltip() {
      const [tip, setTip] = React.useState(null);
      React.useEffect(() => {
        let timer;
        const clear = () => { clearTimeout(timer); setTip(null); };
        const over = (event) => {
          const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
          const path = fileTarget(a?.getAttribute('href'));
          clear();
          if (!path) return;
          const x = event.clientX ?? 16, y = event.clientY ?? 16;
          timer = setTimeout(() => setTip({path, x, y}), 100);
        };
        const out = (event) => {
          const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
          if (a && event.relatedTarget instanceof Node && a.contains(event.relatedTarget)) return;
          clear();
        };
        const key = e => { if(e.key === 'Escape') clear(); };
        document.addEventListener('pointerover', over);
        document.addEventListener('pointerout', out);
        document.addEventListener('scroll', clear, true);
        document.addEventListener('pointerdown', clear);
        document.addEventListener('keydown', key);
        window.addEventListener('blur', clear);
        return () => {
          clearTimeout(timer);
          document.removeEventListener('pointerover', over);
          document.removeEventListener('pointerout', out);
          document.removeEventListener('scroll', clear, true);
          document.removeEventListener('pointerdown', clear);
          document.removeEventListener('keydown', key);
          window.removeEventListener('blur', clear);
        };
      }, []);
      if (!tip) return null;
      return React.createElement('div', {role:'tooltip', style:{
        position:'fixed', left:Math.max(8, Math.min(tip.x, window.innerWidth - Math.min(600,window.innerWidth-16)-8)),
        top:tip.y > window.innerHeight-100 ? Math.max(8,tip.y-80) : tip.y+20,
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
