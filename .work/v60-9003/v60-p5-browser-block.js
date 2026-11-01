  {
    const { ctx, page, errors } = await newPage();
    const home = await page.evaluate(() => {
      const shown = (sel) => { const n = document.querySelector(sel); return !!n && n.offsetParent !== null; };
      const absent = (sel) => { const n = document.querySelector(sel); return !n || n.offsetParent === null; };
      const bar = document.querySelector('.topbar').getBoundingClientRect();
      const badge = document.getElementById('topDataBadge');
      return {
        barH: Math.round(bar.height), barTop: Math.round(bar.top),
        badgeGone: !!badge && badge.offsetParent === null,
        legacy: ['#v58VoiceBadge', '#segMode', '#homeMeta', '#homeStats', '.v58-bento', '.v58-rail', '.sdp-retry-toast'].map(absent),
        v60: ['#sdpHomeGreeting', '#homeHero', '#sdpHeroConfigChips', '#sdpHomeStatsRow', '#sdpQuickPracticeGrid'].map(shown)
      };
    });
    push('v60 next-gen Home: 54px flush topbar, legacy clutter absent, next-gen blocks visible',
      home.barH <= 56 && home.barTop === 0 && home.badgeGone && home.legacy.every(Boolean) && home.v60.every(Boolean), home);
    const setState = await page.evaluate(() => new Promise(resolve => {
      window.SDPCore.UI.setTab('set');
      setTimeout(() => {
        const box = document.getElementById('sdpNextGenSettings');
        const acc = document.getElementById('sdpAppearanceAccordion');
        const body = document.getElementById('setBody');
        resolve({
          boxTop: box ? Math.round(box.getBoundingClientRect().top) : -1,
          boxFirst: !!box && document.getElementById('screen-set').firstElementChild === box,
          accOpen: acc ? acc.open : null,
          bodyInAcc: !!(body && body.closest('details#sdpAppearanceAccordion'))
        });
      }, 300);
    }));
    push('v60 Settings opens on the priority-1 panel with #setBody collapsed inside the accordion',
      setState.boxFirst && setState.boxTop >= 0 && setState.boxTop < 140 && setState.accOpen === false && setState.bodyInAcc, setState);
    const cockpit = await page.evaluate(() => new Promise(resolve => {
      const C = window.SDPCore;
      C.Eng.start({});
      setTimeout(() => {
        try { if (C.Eng.skipReady) C.Eng.skipReady(); } catch (e) {}
        setTimeout(() => {
          const vis = (id) => { const n = document.getElementById(id); return !!n && n.offsetParent !== null; };
          const lens = document.querySelector('#layers .lens');
          resolve({
            card: vis('sdpCockpitCard'), edge: vis('sdpEdgeBar'), timer: vis('sdpTimerPill'),
            dock: vis('sdpCockpitDock'), map: vis('sdpWordMapCard'),
            lensGone: !lens || lens.offsetParent === null,
            status: (document.getElementById('plStatus') || {}).textContent || ''
          });
        }, 1200);
      }, 600);
    }));
    push('v60 active dictation shows the cockpit card, edge bar, timer pill, dock and word map',
      cockpit.card && cockpit.edge && cockpit.timer && cockpit.dock && cockpit.map && cockpit.lensGone, cockpit);
    push('v60 next-gen UI raises no page errors', errors.length === 0, errors);
    await ctx.close();
  }
