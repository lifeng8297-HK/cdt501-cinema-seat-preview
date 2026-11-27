(() => {
  const seatLimit = 4;
  const halls = new Map(Auditorium.halls.map(hall => [hall.id, hall]));
  const cases = Auditorium.halls.filter(hall => hall.basis === 'workbook');
  const sessions = new Map(Auditorium.halls.map(hall => [hall.id, {
    selected: new Set(hall.demo), viewing: hall.demo[0], zoom: 1,
    overview: ['#overview', '#tiers'].includes(location.hash), side: location.hash === '#tiers'
  }]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hall = profileFor(cases[0].caseId, new URLSearchParams(location.search).get('layout'));
  let session = sessions.get(hall.id);
  let mode = ['#overview', '#tiers', '#preview', '#analysis'].includes(location.hash) ? 'preview' : 'map';
  let view = location.hash === '#analysis' ? 'analysis' : '3d';
  let basePose = cameraPose();
  let pose = { ...basePose };
  let travel;
  let yawAim = pose.yaw;
  let pitchAim = pose.pitch;
  let zoomAim = pose.zoom;
  let drag;
  let renderer;
  let frame;
  let lastDraw;
  let previewIntro = false;
  let previewTimer;
  let returningToMap = false;
  let confirmedSeats;

  const get = id => document.getElementById(id);
  const grid = get('seat-grid');
  const seatScroll = get('seat-scroll');
  const workspace = get('workspace');
  const mapPanel = get('map-panel');
  const preview = get('preview-panel');
  const perspective = get('perspective-view');
  const canvas = get('auditorium');
  const viewport = get('viewport');
  const cameraToggle = get('camera-view');
  const sideCamera = get('side-camera');
  const worldSeat = get('world-seat');
  const plan = get('plan-view');
  const profile = get('profile-view');
  const acoustics = get('show-acoustics');
  const chips = get('seat-chips');
  const status = get('selection-status');
  const reset = get('reset-view');
  const rowNavigation = get('row-navigation');
  const rowForward = get('row-forward');
  const rowBack = get('row-back');
  const clear = get('clear-selection');
  const error = get('view-error');
  const seatingEntry = get('seating-entry');
  const analysisEntry = get('analysis-entry');
  const previewSelection = get('preview-selection');
  const selectViewing = get('select-viewing');
  const booking = get('booking-dialog');
  const bookSeats = get('book-seats');
  const exitPanel = get('exit-guide');
  const exitMap = get('exit-map');
  const exitSeat = get('exit-seat');
  const basisButtons = Array.from(document.querySelectorAll('[data-basis]'));
  const hallButtons = new Map();
  const seatButtons = new Map();
  const chipButtons = new Map();

  function profileFor(caseId, basis) {
    const ticket = basis === 'ticket' && halls.get(caseId);
    return ticket || halls.get(`${caseId}-workbook`);
  }

  function cameraPose() {
    if (session.overview) {
      const rear = hall.rows.at(-1)[0];
      if (session.side) {
        const x = -hall.width * 0.39;
        const y = rear.floor * 0.68 + 3;
        const z = hall.screen.z + hall.firstRow * 0.39;
        const depth = (hall.rows[0][0].z + rear.z) / 2 - z;
        return { x, y, z, yaw: Math.atan2(-x, -depth),
          pitch: Math.atan2(rear.floor / 2 + 0.6 - y, Math.hypot(x, depth)), lens: 1.21, zoom: session.zoom, overhead: 1 };
      }
      const y = rear.floor + Math.max(4, hall.screen.height * 0.32);
      const z = hall.length - 0.57;
      const upper = Math.atan2(hall.screen.bottom + hall.screen.height - y, z - hall.screen.z);
      const lower = Math.atan2(rear.floor + 0.65 - y, z - rear.z);
      return { x: 0, y, z, yaw: 0, pitch: (upper + lower) / 2, lens: Math.min(1.56, upper - lower + 0.14), zoom: session.zoom, overhead: 1 };
    }
    const seat = hall.seatMap.get(session.viewing ?? hall.demo[0]);
    const { angle, topElevation, bottomElevation } = Auditorium.sightline(hall, seat);
    const radians = Math.PI / 180;
    return {
      x: seat.x, y: seat.floor + hall.eyeHeight, z: seat.z,
      yaw: angle * radians, pitch: (topElevation + bottomElevation) * radians / 2,
      lens: Math.max(Math.PI / 3, Math.min(1.42, (topElevation - bottomElevation) * radians + 0.16)), zoom: 1, overhead: 0
    };
  }

  for (const option of cases) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => changeHall(profileFor(option.caseId, hall.basis)));
    get('hall-switch').append(button);
    hallButtons.set(option.caseId, button);
  }
  for (const button of basisButtons) {
    button.addEventListener('click', () => changeHall(profileFor(hall.caseId, button.dataset.basis)));
  }

  function rowLabel(row, column) {
    const label = document.createElement('span');
    label.className = 'row-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = row;
    label.style.gridColumn = column;
    return label;
  }

  function buildSeatMap() {
    seatButtons.clear();
    const rows = document.createDocumentFragment();
    for (const row of hall.rows) {
      const line = document.createElement('div');
      line.className = 'seat-row';
      line.append(rowLabel(row[0].row, 1));
      for (const seat of row) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'seat';
        button.textContent = seat.number;
        button.style.gridColumn = seat.slot + 1;
        button.setAttribute('aria-label', `${seat.row} 排 ${seat.number} 座`);
        button.addEventListener('click', () => toggleSeat(seat.id));
        seatButtons.set(seat.id, button);
        line.append(button);
      }
      line.append(rowLabel(row[0].row, hall.columns + 2));
      rows.append(line);
    }
    grid.style.setProperty('--seat-columns', `var(--row-label-width) repeat(${hall.columns}, minmax(var(--seat-min), 1fr)) var(--row-label-width)`);
    grid.style.setProperty('--columns', hall.columns);
    grid.style.setProperty('--map-spacing', `calc(2 * var(--row-label-width) + ${hall.columns + 1} * var(--seat-gap))`);
    grid.replaceChildren(rows);
    seatScroll.scrollLeft = Math.max(0, (seatScroll.scrollWidth - seatScroll.clientWidth) / 2);
    seatScroll.scrollTop = 0;
    get('map').style.setProperty('--screen-span', `${Math.round(hall.screen.width / hall.width * 100)}%`);
    get('map').style.setProperty('--screen-arch', hall.screen.curve ? '50% 50% 0 0 / 95% 95% 0 0' : '7% 7% 0 0 / 15% 15% 0 0');
  }

  const emptySelection = document.createElement('span');
  emptySelection.className = 'selection-empty';
  emptySelection.textContent = '尚未选座';
  chips.append(emptySelection);

  function metric(parent, label, list = false) {
    const container = document.createElement(list ? 'div' : 'span');
    const value = document.createElement(list ? 'dd' : 'strong');
    if (list) {
      const term = document.createElement('dt');
      term.textContent = label;
      container.append(term);
    } else {
      container.append(label);
    }
    container.append(value);
    get(parent).append(container);
    return value;
  }
  const distanceValue = metric('view-metrics', '距银幕中心（水平）');
  const angleValue = metric('view-metrics', '水平偏角');
  const sideValue = metric('analysis-metrics', '水平偏角', true);
  const spanValue = metric('analysis-metrics', '银幕水平张角', true);
  const centerValue = metric('analysis-metrics', '银幕中心仰角', true);
  const subtitleValue = metric('analysis-metrics', '字幕仰角', true);

  function angleText(value) {
    const display = Math.abs(value) < 0.05 ? 0 : value;
    return `${display.toFixed(1)}°`;
  }

  function reportAngle(element, value, direction) {
    element.textContent = angleText(value);
    if (!direction) return;
    const detail = document.createElement('small');
    detail.textContent = direction;
    element.append(detail);
  }

  function announce(message = `最多可选 ${seatLimit} 座`, notice = false) {
    status.textContent = message;
    status.classList.toggle('notice', notice);
  }

  function toggleSeat(id, follow = true) {
    const { selected, viewing } = session;
    if (selected.has(id)) {
      selected.delete(id);
      if (follow && id === viewing) changeView(Array.from(selected).at(-1));
    } else {
      if (selected.size >= seatLimit) {
        announce(`已选满 ${seatLimit} 座，请先取消一个座位`, true);
        return;
      }
      selected.add(id);
      if (follow) changeView(id);
    }
    announce();
    render();
  }

  function changeView(id, animate = true) {
    const previous = session.viewing;
    session.viewing = id;
    if (animate && session.overview) return;
    if (animate && id === previous) {
      recenter();
      return;
    }
    moveCamera(Boolean(animate && id && previous));
  }

  function moveCamera(animate) {
    const next = cameraPose();
    basePose = next;
    yawAim = next.yaw;
    pitchAim = next.pitch;
    zoomAim = next.zoom;
    travel = undefined;
    if (!animate || reduceMotion.matches || mode !== 'preview' || view !== '3d' || !renderer) {
      pose = { ...next };
      return;
    }
    const distance = Math.hypot(next.x - pose.x, next.z - pose.z);
    const changingHeight = Math.abs(next.overhead - pose.overhead) > 0.05;
    travel = {
      source: { ...pose },
      target: next,
      start: performance.now(),
      duration: changingHeight ? (session.overview ? 1000 : 1180) : Math.min(730, 410 + distance * 24),
      lift: changingHeight ? 0.52 : Math.min(0.50, distance * 0.10)
    };
  }

  function changeHall(option) {
    if (hall === option) return;
    stopPreviewFlow();
    hall = option;
    session = sessions.get(hall.id);
    changeView(session.viewing, false);
    for (const button of chipButtons.values()) button.remove();
    chipButtons.clear();
    buildSeatMap();
    announce();
    render();
    fadeScene();
  }

  function fadeScene() {
    if (!reduceMotion.matches && mode === 'preview' && view === '3d') {
      viewport.getAnimations().forEach(animation => animation.cancel());
      viewport.animate([{ opacity: 0.72 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    }
  }

  function syncChips() {
    for (const [id, button] of chipButtons) {
      if (!session.selected.has(id)) {
        button.remove();
        chipButtons.delete(id);
      }
    }
    for (const id of session.selected) {
      let button = chipButtons.get(id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'seat-chip';
        button.textContent = id;
        button.setAttribute('aria-label', `预览座位 ${id}`);
        button.addEventListener('click', () => {
          changeView(id);
          render();
        });
        chips.append(button);
        chipButtons.set(id, button);
      }
      button.disabled = mode === 'map';
      button.setAttribute('aria-pressed', mode === 'preview' && id === session.viewing);
    }
    emptySelection.hidden = session.selected.size > 0;
  }

  function detectOverflow() {
    const horizontal = seatScroll.scrollWidth > seatScroll.clientWidth + 1;
    const vertical = seatScroll.scrollHeight > seatScroll.clientHeight + 1;
    const hint = get('scroll-hint');
    hint.hidden = !horizontal && !vertical;
    hint.textContent = horizontal && vertical ? '滑动查看全部排号和座位' : horizontal ? '横滑查看两侧座位' : '上下滑动查看其他排';
  }

  function renderSources() {
    get('hall-tag').textContent = hall.format;
    get('cinema-name').textContent = hall.name;
    get('source-status').textContent = hall.basis === 'workbook' ? '工作簿重建 · 几何估算' : '票务座位图 · 几何估算';
    get('source-layout').hidden = !halls.has(hall.caseId);
    for (const button of basisButtons) button.setAttribute('aria-pressed', hall.basis === button.dataset.basis);
    get('screen-source-note').textContent = hall.screenNote;
    get('seat-source-note').textContent = hall.seatNote;
    get('screen-source').href = hall.screenSource;
    const seatLink = get('seat-source');
    seatLink.hidden = !hall.seatSource;
    if (hall.seatSource) seatLink.href = hall.seatSource;
    else seatLink.removeAttribute('href');
    get('model-parameters').textContent = `按《影厅几何数据》估算。首排距幕 ${hall.firstRow.toFixed(2)} m，幕下沿 ${hall.screen.bottom.toFixed(2)} m，排距 ${hall.spacing.toFixed(2)} m，座距 ${hall.pitch.toFixed(2)} m，眼高 ${hall.eyeHeight.toFixed(2)} m。逐排标高按基础视线超高 ${hall.clearance.toFixed(2)} m 加高靠背椅余量 ${hall.extraClearance.toFixed(2)} m 递推。弧深 ${hall.screen.curve.toFixed(2)} m 与字幕基线（画面下方 5%）为示意。`;
  }

  function recenter() {
    turn(basePose.yaw, basePose.pitch);
  }

  function inspectSeat(seat) {
    if (!session.overview && session.viewing === seat.id) return;
    stopPreviewFlow();
    session.viewing = seat.id;
    session.overview = false;
    moveCamera(true);
    render();
  }

  function moveRow(offset) {
    const current = hall.seatMap.get(session.viewing);
    if (!current || !renderer) return;
    const row = hall.rows[current.row - 1 + offset];
    if (!row) return;
    const nearest = row.reduce((best, seat) =>
      Math.abs(seat.x - current.x) < Math.abs(best.x - current.x) ? seat : best);
    const focused = document.activeElement;
    inspectSeat(nearest);
    if ((focused === rowForward || focused === rowBack) && focused.disabled) canvas.focus({ preventScroll: true });
  }

  function stopPreviewFlow() {
    clearTimeout(previewTimer);
    previewIntro = false;
    returningToMap = false;
  }

  function showMap() {
    stopPreviewFlow();
    mode = 'map';
    view = '3d';
    travel = undefined;
    render();
    if (!previewSelection.disabled) previewSelection.focus({ preventScroll: true });
    else seatingEntry.focus({ preventScroll: true });
  }

  function leavePreview() {
    stopPreviewFlow();
    if (mode !== 'preview' || view !== '3d' || !renderer || reduceMotion.matches || pose.overhead > 0.96) {
      showMap();
      return;
    }
    returningToMap = true;
    session.overview = true;
    session.side = false;
    moveCamera(true);
    render();
  }

  function enterPreview() {
    if (!session.selected.size) return;
    stopPreviewFlow();
    if (!session.selected.has(session.viewing)) session.viewing = Array.from(session.selected).at(-1);
    mode = 'preview';
    view = '3d';
    session.overview = Boolean(renderer) && !reduceMotion.matches;
    session.side = false;
    previewIntro = session.overview;
    moveCamera(false);
    render();
    if (renderer) canvas.focus({ preventScroll: true });
    preview.scrollIntoView({ block: 'nearest' });
  }

  function drawExitRoute() {
    if (mode !== 'exit' || !confirmedSeats) return;
    const { hall: model, seats } = confirmedSeats;
    const seat = model.seatMap.get(exitSeat.value);
    const route = ExitGuide.route(model, seat);
    const { exit, distance } = route;
    get('exit-summary').textContent = `示意出口 ${exit.id} · ${exit.label}。模型平面距离 ${distance.toFixed(1)} m。`;
    const steps = [
      `从 ${seat.row} 排 ${seat.number} 座进入本排通道。`,
      `面向银幕，沿本排往${exit.side}侧通道。`,
      `沿侧通道往${exit.end}，到达示意出口 ${exit.id}。`
    ];
    get('exit-steps').replaceChildren(...steps.map(step => {
      const item = document.createElement('li');
      item.textContent = step;
      return item;
    }));
    ExitGuide.draw(exitMap, model, seats, seat, route);
  }

  function showExitGuide() {
    stopPreviewFlow();
    travel = undefined;
    const seats = Array.from(session.selected, id => hall.seatMap.get(id));
    if (!seats.length) return;
    confirmedSeats = { hall, seats };
    exitSeat.replaceChildren(...seats.map(seat => new Option(`${seat.row} 排 ${seat.number} 座`, seat.id)));
    if (session.selected.has(session.viewing)) exitSeat.value = session.viewing;
    mode = 'exit';
    render();
    drawExitRoute();
    const title = get('exit-title');
    title.focus({ preventScroll: true });
    exitPanel.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const previewing = mode === 'preview';
    const showingRoute = mode === 'exit';
    const focusedPreview = previewing && view === '3d';
    const seat = hall.seatMap.get(session.viewing);
    workspace.classList.toggle('map-only', !previewing);
    workspace.classList.toggle('focused-preview', focusedPreview);
    workspace.classList.toggle('wide-map', hall.columns > 12);
    workspace.hidden = showingRoute;
    get('seat-selection').hidden = showingRoute;
    exitPanel.hidden = !showingRoute;
    mapPanel.hidden = focusedPreview;
    preview.hidden = !previewing;
    perspective.hidden = view !== '3d';
    get('analysis-view').hidden = view !== 'analysis';
    seatingEntry.setAttribute('aria-pressed', !showingRoute && view !== 'analysis');
    analysisEntry.setAttribute('aria-pressed', previewing && view === 'analysis');
    get('preview-title').textContent = view === 'analysis' ? '俯视与视线分析' : '座位视角预览';
    for (const [id, button] of hallButtons) {
      button.disabled = showingRoute;
      button.setAttribute('aria-pressed', id === hall.caseId);
    }
    for (const button of basisButtons) button.disabled = showingRoute;
    for (const [id, button] of seatButtons) {
      button.setAttribute('aria-pressed', session.selected.has(id));
      button.classList.toggle('viewing', previewing && id === session.viewing);
    }
    const screenWidth = `${hall.screen.width.toFixed(2)} m`;
    get('map').setAttribute('aria-label', `${hall.label}座位图`);
    get('map-meta').textContent = `${hall.rows.length} 排 · ${hall.seatMap.size} ${hall.basis === 'workbook' ? '个模型座位' : '座'}`;
    get('screen-mark-label').textContent = `银幕 · ${screenWidth}`;
    get('preview-meta').textContent = `${hall.screen.width.toFixed(2)} × ${hall.screen.height.toFixed(2)} m`;
    renderSources();
    syncChips();
    get('seat-count').textContent = `${session.selected.size} / ${seatLimit}`;
    clear.disabled = !session.selected.size;
    bookSeats.disabled = !session.selected.size;
    previewSelection.disabled = returningToMap || (!focusedPreview && !session.selected.size);
    previewSelection.textContent = focusedPreview ? '返回座位图' : '预览视角';
    selectViewing.hidden = !seat || !renderer || session.overview;
    selectViewing.textContent = session.selected.has(session.viewing) ? '取消此座' : '选此座';
    viewport.classList.toggle('empty', !seat && !session.overview);
    viewport.classList.toggle('overview', session.overview);
    canvas.tabIndex = renderer ? 0 : -1;
    rowNavigation.hidden = !seat || !renderer;
    rowForward.disabled = !seat || seat.row === 1;
    rowBack.disabled = !seat || seat.row === hall.rows.length;
    get('view-empty').hidden = Boolean(seat) || session.overview || !renderer;
    get('view-drag').hidden = !renderer || (!seat && !session.overview);
    get('view-drag').textContent = session.overview ? '滚轮缩放 · 点座入座' : '点座换位 · 拖动环视';
    get('view-seat').hidden = !renderer || (!seat && !session.overview);
    get('view-seat').textContent = session.overview ? (session.side ? '斜侧 · 台阶' : '影厅总览') : seat ? `${seat.row} 排 · ${seat.number} 座` : '';
    sideCamera.hidden = !session.overview || !renderer;
    sideCamera.textContent = session.side ? '返回总览' : '斜侧看台阶';
    cameraToggle.hidden = !renderer;
    cameraToggle.disabled = session.overview && !seat;
    cameraToggle.textContent = session.overview ? (seat ? `进入 ${seat.id} 视角` : '选座后进入视角') : '影厅总览';
    worldSeat.textContent = seat?.id ?? '';
    if (!seat || !renderer) worldSeat.hidden = true;
    get('analysis-seat').textContent = seat ? `${seat.row} 排 ${seat.number} 座` : '尚未选座';
    get('profile-rise').textContent = seat ? `${seat.row} 排地面 +${seat.floor.toFixed(2)} m` : '标高相对首排';
    get('view-metrics').hidden = !seat;
    get('analysis-metrics').hidden = !seat;
    if (seat) {
      const { distance, angle, span, centerElevation, subtitleElevation } = Auditorium.sightline(hall, seat);
      distanceValue.textContent = `${distance.toFixed(1)} m`;
      angleValue.textContent = angleText(Math.abs(angle));
      reportAngle(sideValue, Math.abs(angle), Math.abs(angle) < 0.05 ? '' : angle > 0 ? '向右' : '向左');
      reportAngle(spanValue, span);
      reportAngle(centerValue, centerElevation);
      reportAngle(subtitleValue, subtitleElevation);
    }
    detectOverflow();
    scheduleDraw();
  }

  function scheduleDraw() {
    const centered = yawAim === basePose.yaw && pitchAim === basePose.pitch;
    reset.disabled = !session.viewing || session.overview || !renderer || centered;
    if (mode === 'preview' && !frame) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = undefined;
    if (mode !== 'preview') return;
    if (view === 'analysis') {
      const seat = hall.seatMap.get(session.viewing);
      AnalysisView.plan(plan, hall, session.selected, seat, acoustics.checked);
      AnalysisView.profile(profile, hall, seat, seat && Auditorium.sightline(hall, seat));
      return;
    }
    if (!renderer) return;
    const elapsed = Math.min(64, now - (lastDraw ?? now - 16));
    lastDraw = now;
    if (travel) {
      const progress = Math.max(0, Math.min(1, (now - travel.start) / travel.duration));
      const eased = progress ** 3 * (10 + progress * (-15 + 6 * progress));
      const { source, target, lift } = travel;
      for (const key of ['x', 'y', 'z', 'lens', 'overhead']) {
        pose[key] = source[key] + (target[key] - source[key]) * eased;
      }
      pose.y += Math.sin(Math.PI * eased) * lift;
      const yawDelta = Math.atan2(Math.sin(yawAim - source.yaw), Math.cos(yawAim - source.yaw));
      pose.yaw = progress === 1 ? yawAim : source.yaw + yawDelta * eased;
      pose.pitch = source.pitch + (pitchAim - source.pitch) * eased;
      pose.zoom = source.zoom + (zoomAim - source.zoom) * eased;
      if (progress === 1) travel = undefined;
    }
    const aiming = !reduceMotion.matches && Math.max(Math.abs(pose.yaw - yawAim),
      Math.abs(pose.pitch - pitchAim), Math.abs(pose.zoom - zoomAim)) > 0.001;
    if (!travel) {
      const blend = aiming ? 1 - Math.exp(-elapsed / 29) : 1;
      pose.yaw += (yawAim - pose.yaw) * blend;
      pose.pitch += (pitchAim - pose.pitch) * blend;
      pose.zoom += (zoomAim - pose.zoom) * blend;
    }
    const moving = Boolean(travel || aiming || drag?.moved) && !reduceMotion.matches;
    const marker = renderer.draw(hall, pose, moving, hall.seatMap.get(session.viewing));
    if (previewIntro) {
      previewIntro = false;
      previewTimer = setTimeout(() => {
        session.overview = false;
        moveCamera(true);
        render();
      }, 230);
    }
    worldSeat.hidden = !marker;
    if (marker) {
      worldSeat.style.transform = `translate3d(${marker.x}px, ${marker.y - 8}px, 0) translate(-50%, -100%)`;
      worldSeat.style.opacity = Math.min(1, (pose.overhead - 0.08) / 0.35);
    }
    if (returningToMap && !travel) {
      showMap();
      return;
    }
    if (travel || aiming) scheduleDraw();
  }

  function turn(yaw, pitch = pitchAim) {
    yawAim = Math.max(-1.23, Math.min(1.23, yaw));
    pitchAim = Math.max(-0.85, Math.min(1.30, pitch));
    scheduleDraw();
  }

  seatingEntry.addEventListener('click', leavePreview);
  analysisEntry.addEventListener('click', () => {
    stopPreviewFlow();
    travel = undefined;
    mode = 'preview';
    view = 'analysis';
    render();
  });
  previewSelection.addEventListener('click', () => {
    if (mode === 'preview' && view === '3d') leavePreview();
    else enterPreview();
  });
  clear.addEventListener('click', () => {
    stopPreviewFlow();
    session.selected.clear();
    changeView(undefined, false);
    announce();
    render();
    if (mapPanel.hidden) canvas.focus({ preventScroll: true });
    else seatButtons.get(hall.demo[0]).focus();
  });
  selectViewing.addEventListener('click', () => {
    if (session.viewing) toggleSeat(session.viewing, false);
  });
  bookSeats.addEventListener('click', () => {
    get('booking-hall').textContent = hall.name;
    get('booking-seats').textContent = Array.from(session.selected, id => {
      const seat = hall.seatMap.get(id);
      return `${seat.row} 排 ${seat.number} 座`;
    }).join(' · ');
    booking.returnValue = '';
    booking.showModal();
  });
  booking.addEventListener('close', () => {
    if (booking.returnValue === 'confirm') showExitGuide();
  });
  get('exit-back').addEventListener('click', showMap);
  exitSeat.addEventListener('change', drawExitRoute);
  new ResizeObserver(drawExitRoute).observe(exitMap);
  reset.addEventListener('click', recenter);
  for (const [button, offset] of [[rowForward, -1], [rowBack, 1]]) {
    button.addEventListener('click', () => moveRow(offset));
  }
  cameraToggle.addEventListener('click', () => {
    stopPreviewFlow();
    session.overview = !session.overview;
    moveCamera(true);
    render();
  });
  sideCamera.addEventListener('click', () => {
    stopPreviewFlow();
    session.side = !session.side;
    moveCamera(false);
    render();
    fadeScene();
  });
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches && travel) changeView(session.viewing, false);
    scheduleDraw();
  });

  acoustics.addEventListener('change', () => {
    for (const label of document.querySelectorAll('.acoustics-key')) label.hidden = !acoustics.checked;
    get('chart-note').textContent = acoustics.checked
      ? '声场使用假设的扬声器位置。角度按重建几何估算，负仰角表示目标低于座位眼高。'
      : '角度按重建几何估算。仰角为负值时，目标低于座位眼高。';
    scheduleDraw();
  });

  canvas.addEventListener('pointerdown', event => {
    if (!renderer || !event.isPrimary || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: yawAim, pitch: pitchAim, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved && session.viewing && !session.overview) {
      turn(drag.yaw - dx * 0.0048, drag.pitch + dy * 0.0040);
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
    drag = undefined;
    if (!moved) {
      const hit = renderer?.pickSeat(hall, event.clientX, event.clientY, session.overview ? undefined : session.viewing);
      if (hit) inspectSeat(hit);
    }
    scheduleDraw();
  });
  canvas.addEventListener('lostpointercapture', () => {
    drag = undefined;
    scheduleDraw();
  });
  canvas.addEventListener('wheel', event => {
    if (!session.overview || !renderer || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const delta = event.deltaY * unit;
    session.zoom = Math.max(0.72, Math.min(2.30, session.zoom * Math.exp(-delta * 0.0015)));
    zoomAim = session.zoom;
    scheduleDraw();
  }, { passive: false });
  perspective.addEventListener('keydown', event => {
    if (!session.viewing || !renderer || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      moveRow(event.key === 'ArrowUp' ? -1 : 1);
      event.preventDefault();
      return;
    }
    if (session.overview) return;
    switch (event.key) {
      case 'ArrowLeft': turn(yawAim - 0.12); break;
      case 'ArrowRight': turn(yawAim + 0.12); break;
      case 'ArrowUp': turn(yawAim, pitchAim + 0.10); break;
      case 'ArrowDown': turn(yawAim, pitchAim - 0.10); break;
      case 'Home': recenter(); break;
      default: return;
    }
    event.preventDefault();
  });

  function initializeView() {
    try {
      renderer = Auditorium.create(canvas);
      error.hidden = true;
    } catch (reason) {
      error.hidden = false;
      console.warn(reason);
    }
    render();
  }

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer = undefined;
    error.hidden = false;
    if (returningToMap) {
      showMap();
      return;
    }
    render();
  });
  canvas.addEventListener('webglcontextrestored', initializeView);
  const resize = new ResizeObserver(() => {
    detectOverflow();
    scheduleDraw();
  });
  for (const element of [viewport, plan, profile, seatScroll, grid]) resize.observe(element);
  buildSeatMap();
  initializeView();
})();
