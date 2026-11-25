const AnalysisView = (() => {
  const centerColor = '#70d7ca';
  const subtitleColor = '#edc579';
  const referenceColor = '#a4b4a8';
  const activeColor = '#e5ffb2';
  const fields = new WeakMap();

  function surface(canvas) {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsWide = Math.round(width * density);
    const pixelsHigh = Math.round(height * density);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px Microsoft YaHei UI, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    return { ctx, width, height };
  }

  function line(ctx, from, to, color, weight = 1, dash = []) {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.lineWidth = weight;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dot(ctx, [x, y], radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function text(ctx, value, x, y, color, align = 'left') {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function arc(ctx, [x, y], radius, start, end, color) {
    if (Math.abs(end - start) < 0.015) return;
    ctx.beginPath();
    ctx.arc(x, y, radius, start, end, end < start);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function field(hall) {
    if (fields.has(hall)) return fields.get(hall);
    const texture = document.createElement('canvas');
    texture.width = 120;
    texture.height = Math.round(texture.width * hall.length / hall.width);
    const ctx = texture.getContext('2d');
    const pixels = ctx.createImageData(texture.width, texture.height);
    const peak = Math.max(...hall.speakers.map(({x, z}) => Auditorium.strength(hall, x, z)));
    for (let row = 0; row < texture.height; row++) {
      const z = hall.length * (row + 0.5) / texture.height;
      for (let column = 0; column < texture.width; column++) {
        const x = hall.width * ((column + 0.5) / texture.width - 0.5);
        const relative = Math.min(1, Math.sqrt(Auditorium.strength(hall, x, z) / peak));
        const index = (row * texture.width + column) * 4;
        pixels.data.set([27 + relative * 174, 85 + relative * 111, 108 + relative * 15, 100 + relative * 129], index);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    fields.set(hall, texture);
    return texture;
  }

  function plan(canvas, hall, selected, seat, showAcoustics) {
    const shot = surface(canvas);
    if (!shot) return;
    const { ctx, width, height } = shot;
    const scale = Math.min((width - 50) / hall.width, (height - 42) / hall.length);
    const left = (width - hall.width * scale) / 2;
    const top = 23;
    const point = (x, z) => [width / 2 + x * scale, top + z * scale];
    const { screen } = hall;
    const roomWidth = hall.width * scale, roomHeight = hall.length * scale;
    ctx.fillStyle = '#172923';
    ctx.fillRect(left, top, roomWidth, roomHeight);
    if (showAcoustics) ctx.drawImage(field(hall), left, top, roomWidth, roomHeight);
    ctx.strokeStyle = '#7c9c8b';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, roomWidth, roomHeight);

    for (const row of hall.rows) {
      const y = point(0, row[0].z)[1];
      if (row[0].row === 1 || row[0].row === hall.rows.length || row[0].row % 3 === 0 || seat?.row === row[0].row) {
        text(ctx, row[0].row, left - 7, y, referenceColor, 'right');
      }
      if (seat?.row === row[0].row) line(ctx, [left + 1, y], [left + roomWidth - 1, y], '#c9e4be91', 1, [2, 3]);
      for (const other of row) {
        dot(ctx, point(other.x, other.z), Math.min(3.0, hall.pitch * scale / 3),
          selected.has(other.id) ? activeColor : '#acc6b8');
      }
    }

    const leftEdge = point(-screen.width / 2, screen.z + screen.curve);
    const rightEdge = point(screen.width / 2, screen.z + screen.curve);
    const center = point(0, screen.z);
    if (seat) {
      const origin = point(seat.x, seat.z);
      const straight = point(seat.x, screen.z);
      ctx.beginPath();
      ctx.moveTo(...origin);
      ctx.lineTo(...leftEdge);
      ctx.lineTo(...rightEdge);
      ctx.closePath();
      ctx.fillStyle = '#7be8cb23';
      ctx.fill();
      line(ctx, origin, leftEdge, '#9cdbc3bd', 1);
      line(ctx, origin, rightEdge, '#9cdbc3bd', 1);
      line(ctx, origin, straight, '#f0f5e3', 1, [4, 4]);
      line(ctx, origin, center, centerColor, 1.9);
      const angle = Math.atan2(center[1] - origin[1], center[0] - origin[0]);
      arc(ctx, origin, 20, -Math.PI / 2, angle, '#fbf1b6');
      dot(ctx, origin, 6, '#1d3228');
      dot(ctx, origin, 4.2, activeColor);
    }

    ctx.beginPath();
    ctx.moveTo(...leftEdge);
    ctx.quadraticCurveTo(center[0], center[1] - screen.curve * scale, ...rightEdge);
    ctx.strokeStyle = '#d1f5d2';
    ctx.lineWidth = 2.3;
    ctx.stroke();
    text(ctx, '银幕', width / 2, 10, '#dce9dc', 'center');
    dot(ctx, center, 2.4, '#d1f5d2');

    if (!showAcoustics) return;
    for (const speaker of hall.speakers) {
      const [x, y] = point(speaker.x, speaker.z);
      ctx.fillStyle = '#443228';
      ctx.fillRect(x - 4.2, y - 4.2, 8.4, 8.4);
      ctx.fillStyle = '#edc579';
      ctx.fillRect(x - 2.8, y - 2.8, 5.6, 5.6);
    }
  }

  function profile(canvas, hall, seat, metrics) {
    const shot = surface(canvas);
    if (!shot) return;
    const { ctx, width, height } = shot;
    const { screen, treads } = hall;
    const top = screen.bottom + screen.height;
    // The section follows the chosen seat's horizontal sightline to the screen center.
    const sectionStretch = seat ? metrics.distance / (seat.z - screen.z) : 1;
    const depth = (hall.length - screen.z) * sectionStretch;
    const unit = Math.min((height - 36) / Math.max(top, metrics?.eye ?? 0), (width - 52) / depth);
    const screenX = width - 34;
    const floorY = height - 24;
    const point = (z, y) => [screenX - (z - screen.z) * sectionStretch * unit, floorY - y * unit];
    const steps = treads.flatMap(({ start, end, height }, index) => [
      point(index === 0 ? screen.z : start, height), point(end, height)
    ]);
    ctx.beginPath();
    ctx.moveTo(...steps[0]);
    for (const step of steps.slice(1)) ctx.lineTo(...step);
    ctx.lineTo(...point(hall.length, 0));
    ctx.closePath();
    ctx.fillStyle = '#5b493a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(...steps[0]);
    for (const step of steps.slice(1)) ctx.lineTo(...step);
    ctx.strokeStyle = '#b89b74';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    text(ctx, '首排', point(hall.rows[0][0].z, 0)[0], floorY + 13, referenceColor, 'center');
    text(ctx, '末排', point(hall.rows.at(-1)[0].z, 0)[0], floorY + 13, referenceColor, 'center');

    const screenTop = point(screen.z, top);
    const screenBottom = point(screen.z, screen.bottom);
    line(ctx, screenTop, screenBottom, '#d1f5d2', 3);
    if (!seat) return;

    const eye = point(seat.z, metrics.eye);
    const center = point(screen.z, metrics.center);
    const subtitle = point(screen.z, metrics.subtitle);
    const seatFloor = point(seat.z, seat.floor);
    const tread = treads[seat.row - 1];
    line(ctx, point(Math.max(tread.start, seat.z - hall.spacing / 2), tread.height),
      point(Math.min(tread.end, seat.z + hall.spacing / 2), tread.height), activeColor, 2.2);
    line(ctx, eye, seatFloor, '#c8d4b1', 1);
    line(ctx, eye, [screenTop[0] + 4, eye[1]], referenceColor, 1, [4, 4]);
    line(ctx, eye, center, centerColor, 1.7);
    line(ctx, eye, subtitle, subtitleColor, 1.6);
    arc(ctx, eye, 24, 0, -metrics.centerElevation * Math.PI / 180, centerColor);
    arc(ctx, eye, 34, 0, -metrics.subtitleElevation * Math.PI / 180, subtitleColor);
    dot(ctx, eye, 3.7, activeColor);
    dot(ctx, center, 3.0, centerColor);
    dot(ctx, subtitle, 3.0, subtitleColor);
    text(ctx, seat.id, eye[0], eye[1] - 13, activeColor, 'center');
    const gap = center[1] + 14 - subtitle[1];
    text(ctx, '中心', center[0] + 7, center[1] - Math.max(0, gap / 2), centerColor);
    text(ctx, '字幕', subtitle[0] + 7, subtitle[1] + Math.max(0, gap / 2), subtitleColor);
  }

  return { plan, profile };
})();
