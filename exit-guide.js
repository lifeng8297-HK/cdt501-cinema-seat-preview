const ExitGuide = (() => {
  function exits(hall) {
    const edge = hall.width / 2 - 0.65;
    const front = hall.screen.z + 2.65;
    const back = hall.length - 0.85;
    return [
      { id: 'A', x: -edge, z: front, label: '左前出口', side: '左', end: '银幕方向' },
      { id: 'B', x: edge, z: front, label: '右前出口', side: '右', end: '银幕方向' },
      { id: 'C', x: -edge, z: back, label: '左后出口', side: '左', end: '后排方向' },
      { id: 'D', x: edge, z: back, label: '右后出口', side: '右', end: '后排方向' }
    ];
  }

  function route(hall, seat) {
    const gapZ = seat.z - Math.min(0.46, hall.spacing * 0.43);
    const candidates = exits(hall).map(exit => ({
      exit, distance: seat.z - gapZ + Math.abs(seat.x - exit.x) + Math.abs(gapZ - exit.z),
      points: [[seat.x, seat.z], [seat.x, gapZ], [exit.x, gapZ], [exit.x, exit.z]]
    }));
    return candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
  }

  function draw(canvas, hall, seats, active, path) {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const dpi = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpi);
    canvas.height = Math.round(height * dpi);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpi, dpi);
    const scale = Math.min((width - 42) / hall.width, (height - 48) / hall.length);
    const left = (width - hall.width * scale) / 2;
    const top = (height - hall.length * scale) / 2;
    const point = (x, z) => [width / 2 + x * scale, top + z * scale];
    const center = (x, y, radius, color) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    };

    ctx.fillStyle = '#1a2820';
    ctx.fillRect(left, top, hall.width * scale, hall.length * scale);
    ctx.strokeStyle = '#4c6150';
    ctx.strokeRect(left, top, hall.width * scale, hall.length * scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#b8cbbc';
    ctx.fillText('银幕', width / 2, top - 11);
    ctx.fillRect(width / 2 - hall.screen.width * scale / 2, top + 4, hall.screen.width * scale, 2);

    const seatSize = Math.max(1.5, hall.pitch * scale * 0.74);
    for (const row of hall.rows) {
      for (const seat of row) {
        const [x, y] = point(seat.x, seat.z);
        ctx.fillStyle = '#547060';
        ctx.fillRect(x - seatSize / 2, y - seatSize / 2, seatSize, seatSize);
      }
    }

    const marks = seats.map(seat => point(seat.x, seat.z));
    for (const [x, z] of marks) center(x, z, 3, '#e7faba');
    const track = path.points.map(([x, z]) => point(x, z));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...track[0]);
    for (const position of track.slice(1)) ctx.lineTo(...position);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#102115';
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#dafaad';
    ctx.stroke();

    for (const exit of exits(hall)) {
      const [x, y] = point(exit.x, exit.z);
      const selected = exit.id === path.exit.id;
      ctx.fillStyle = selected ? '#dafaad' : '#294437';
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeStyle = selected ? '#f0ffd8' : '#7d9c88';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 9, y - 9, 18, 18);
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillStyle = selected ? '#182419' : '#e3ebdd';
      ctx.fillText(exit.id, x, y);
    }
    const [startX, startY] = point(active.x, active.z);
    center(startX, startY, 5, '#16251b');
    center(startX, startY, 3.5, '#dafaad');
  }

  return { route, draw };
})();
