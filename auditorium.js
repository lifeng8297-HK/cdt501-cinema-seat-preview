const Auditorium = (() => {
  function configure(layout) {
    const { columns, pitch, firstRow, spacing, eyeHeight, clearance, extraClearance, width, aspect } = layout;
    const sightlineClearance = clearance + extraClearance;
    const screen = { ...layout.screen, z: 0.54 };
    const imageHeight = Math.min(screen.height, screen.width / aspect);
    screen.image = {
      width: imageHeight * aspect, height: imageHeight,
      bottom: screen.bottom + (screen.height - imageHeight) / 2
    };
    let eye = eyeHeight;
    const rows = layout.seats.map((ranges, index) => {
      const row = index + 1;
      const distance = firstRow + index * spacing;
      if (index) eye = screen.bottom + (eye + sightlineClearance - screen.bottom) * distance / (distance - spacing);
      const floor = eye - eyeHeight;
      const z = screen.z + distance;
      return ranges.flatMap(([first, last, start], group) => {
        return Array.from({ length: first - last + 1 }, (_, offset) => {
          const number = first - offset;
          const slot = start + offset;
          const x = layout.workbookGrid
            ? ((layout.workbookGrid.perRow + 1) / 2 - number) * pitch + (group - 1) * layout.workbookGrid.aisleWidth
            : (slot - (columns + 1) / 2) * pitch;
          return { id: `${row}-${number}`, row, number, slot, x, z, floor };
        });
      });
    });
    const length = rows.at(-1)[0].z + 4.40;
    const treads = rows.map(([seat], index) => ({
      start: index === 0 ? 0 : seat.z - spacing / 2,
      end: index === rows.length - 1 ? length : seat.z + spacing / 2,
      height: seat.floor
    }));
    const speakers = [
      { x: -screen.width * 0.42, z: 0.37, power: 1.15 },
      { x: 0, z: 0.37, power: 1.4 },
      { x: screen.width * 0.42, z: 0.37, power: 1.15 },
      { x: -width / 2 + 0.42, z: length * 0.57, power: 0.55 },
      { x: width / 2 - 0.42, z: length * 0.57, power: 0.55 }
    ];
    const seatMap = new Map(rows.flat().map(seat => [seat.id, seat]));
    if (seatMap.size !== layout.capacity) throw new Error(`Invalid capacity for ${layout.id}`);
    return { ...layout, screen, rows, treads, seatMap, length, speakers };
  }

  const halls = CinemaLayouts.map(configure);
  const radiansToDegrees = value => value * 180 / Math.PI;
  const subtitleHeight = screen => screen.image.bottom + screen.image.height * 0.05;

  function sightline(hall, seat) {
    const { screen, eyeHeight } = hall;
    const depth = seat.z - screen.z;
    const distance = Math.hypot(seat.x, depth);
    const eye = seat.floor + eyeHeight;
    const center = screen.bottom + screen.height / 2;
    const subtitle = subtitleHeight(screen);
    const halfWidth = screen.width / 2;
    const edgeDepth = depth - screen.curve;
    return {
      eye, center, subtitle, distance,
      angle: radiansToDegrees(Math.atan2(-seat.x, depth)),
      span: radiansToDegrees(Math.atan2(halfWidth - seat.x, edgeDepth) - Math.atan2(-halfWidth - seat.x, edgeDepth)),
      centerElevation: radiansToDegrees(Math.atan2(center - eye, distance)),
      subtitleElevation: radiansToDegrees(Math.atan2(subtitle - eye, distance)),
      topElevation: radiansToDegrees(Math.atan2(screen.bottom + screen.height - eye, distance)),
      bottomElevation: radiansToDegrees(Math.atan2(screen.bottom - eye, distance))
    };
  }

  function strength(hall, x, z) {
    return hall.speakers.reduce((total, speaker) => {
      const distanceSquared = (speaker.x - x) ** 2 + (speaker.z - z) ** 2;
      return total + speaker.power / (distanceSquared + 3.8);
    }, 0);
  }

  function buildRoom(hall) {
    const vertices = [];
    const add = (position, color, uv = [0, 0], textured = 0) => {
      vertices.push(...position, ...color, ...uv, textured);
    };
    function quad(a, b, c, d, color, texture) {
      const [start, end, flags] = texture ? [...texture, 1] : [0, 1, 0];
      add(a, color, [start, 0], flags);
      add(b, color, [end, 0], flags);
      add(c, color, [end, 1], flags);
      add(a, color, [start, 0], flags);
      add(c, color, [end, 1], flags);
      add(d, color, [start, 1], flags);
    }
    const shade = (color, brightness) => color.map(value => value * brightness);
    function box(x, y, z, width, height, length, color) {
      const left = x - width / 2, right = x + width / 2;
      const bottom = y - height / 2, top = y + height / 2;
      const front = z - length / 2, back = z + length / 2;
      quad([left, bottom, front], [left, top, front], [right, top, front], [right, bottom, front], shade(color, 0.83));
      quad([left, bottom, back], [right, bottom, back], [right, top, back], [left, top, back], color);
      quad([left, bottom, front], [left, bottom, back], [left, top, back], [left, top, front], shade(color, 0.63));
      quad([right, bottom, back], [right, bottom, front], [right, top, front], [right, top, back], shade(color, 0.72));
      quad([left, top, back], [right, top, back], [right, top, front], [left, top, front], shade(color, 1.23));
      quad([left, bottom, front], [right, bottom, front], [right, bottom, back], [left, bottom, back], shade(color, 0.55));
    }
    function cushion(x, y, z, width, height, thickness, color) {
      const radius = 0.10;
      const w = width / 2, h = height / 2;
      const outline = [[-w + radius, -h], [w - radius, -h], [w, -h + radius], [w, h - radius],
        [w - radius, h], [-w + radius, h], [-w, h - radius], [-w, -h + radius]];
      const front = outline.map(([a, b]) => [x + a, y + b, z - thickness / 2 + b * 0.16]);
      const back = outline.map(([a, b]) => [x + a, y + b, z + thickness / 2 + b * 0.16]);
      const bevel = outline.map(([a, b]) => [x + a * 0.91, y + b * 0.92, z + thickness / 2 + b * 0.16 + 0.035]);
      for (let index = 0; index < outline.length; index++) {
        const next = (index + 1) % outline.length;
        const brightness = [0.57, 0.68, 0.76, 0.97, 1.44, 1.12, 0.90, 0.65][index];
        quad(front[index], front[next], back[next], back[index], shade(color, brightness));
        quad(back[index], back[next], bevel[next], bevel[index], shade(color, brightness * 1.10));
        add([x, y, z + thickness / 2 + 0.035], color);
        add(bevel[index], color);
        add(bevel[next], color);
        add([x, y, z - thickness / 2], shade(color, 0.76));
        add(front[next], shade(color, 0.76));
        add(front[index], shade(color, 0.76));
      }
    }

    const { wood, fabric, screen, rows, treads, width, ceiling, length, pitch } = hall;
    const wallX = width / 2;
    const floorColor = [0.113, 0.106, 0.082];
    const wall = [0.16, 0.135, 0.103];
    const dark = [0.055, 0.063, 0.055];
    const brass = [0.68, 0.49, 0.26];
    const stepLight = [0.42, 0.33, 0.19];
    box(0, -0.13, length / 2, width + 0.1, 0.25, length, floorColor);
    box(0, ceiling / 2, 0.15, width + 0.2, ceiling, 0.3, [0.105, 0.112, 0.088]);
    box(0, ceiling / 2, length, width + 0.2, ceiling, 0.23, wall);
    box(0, ceiling, length / 2, width + 0.2, 0.28, length, [0.083, 0.089, 0.074]);
    box(0, 0.15, 1.39, width * 0.91, 0.32, 1.87, [0.185, 0.16, 0.106]);
    box(0, 0.22, 2.34, width * 0.91, 0.04, 0.026, brass);

    for (const side of [-1, 1]) {
      box(side * wallX, ceiling / 2, length / 2, 0.25, ceiling, length, wall);
      const trimX = (wallX + screen.width / 2) / 2;
      box(side * trimX, ceiling / 2, 0.40, wallX - screen.width / 2 - 0.22, ceiling * 0.82, 0.23, wood);
      for (let index = 0; index < Math.floor((length - 1.5) / 0.53); index++) {
        const z = 0.82 + index * 0.53;
        box(side * (wallX - 0.20), ceiling / 2, z, 0.22, ceiling * 0.95, 0.19, wood);
        if (index % 4 === 0) {
          box(side * (wallX - 0.34), ceiling / 2, z, 0.045, ceiling * 0.87, 0.055, [0.86, 0.62, 0.34]);
        }
      }
      box(side * (wallX - 0.60), ceiling - 0.31, length / 2, 0.07, 0.05, length - 1.0, [0.49, 0.37, 0.22]);
      box(side * trimX, ceiling / 2, 0.55, 0.037, ceiling * 0.70, 0.037, brass);
    }

    function screenSurface(border, offset, color, textured) {
      const pieces = screen.curve ? 24 : 1;
      const halfWidth = screen.width / 2 + border;
      const low = screen.bottom - border;
      const high = screen.bottom + screen.height + border;
      const depth = x => screen.z + screen.curve * (x / halfWidth) ** 2 + offset;
      for (let index = 0; index < pieces; index++) {
        const u0 = index / pieces, u1 = (index + 1) / pieces;
        const x0 = halfWidth * (2 * u0 - 1), x1 = halfWidth * (2 * u1 - 1);
        const z0 = depth(x0), z1 = depth(x1);
        quad([x0, low, z0], [x1, low, z1], [x1, high, z1], [x0, high, z0], color, textured ? [u0, u1] : undefined);
      }
    }
    screenSurface(0.20, -0.035, dark, false);
    screenSurface(0, 0, [1, 1, 1], true);

    for (const [index, row] of rows.entries()) {
      if (index === 0) continue;
      const { start, end, height } = treads[index];
      const treadColor = shade(floorColor, index % 2 === 0 ? 1.13 : 0.92);
      box(0, height / 2, (start + end) / 2, width - 0.30, height, end - start, treadColor);
      box(0, height - 0.016, start - 0.006, width - 0.43, 0.025, 0.026, [0.23, 0.19, 0.126]);
      for (const [column, seat] of row.entries()) {
        const next = row[column + 1];
        if (next && next.slot - seat.slot > 1) {
          box((seat.x + next.x) / 2, height + 0.007, start + 0.024,
            next.x - seat.x - pitch, 0.014, 0.038, stepLight);
        }
      }
    }
    const rowEnds = [vertices.length / 9];
    for (const [index, row] of rows.entries()) {
      for (const seat of row) {
        const { x, z, floor } = seat;
        const textile = shade(fabric, index % 2 === 0 ? 1.0 : 0.9);
        const chairWidth = pitch * 0.79;
        const cushionDepth = 0.60;
        box(x, floor + 0.16, z, chairWidth * 0.62, 0.34, 0.38, dark);
        box(x, floor + 0.43, z - 0.08, chairWidth - 0.04, 0.18, cushionDepth, textile);
        cushion(x, floor + 0.75, z + 0.29, chairWidth, 0.66, 0.17, textile);
        for (const direction of [-1, 1]) {
          box(x + direction * chairWidth * 0.50, floor + 0.58, z - 0.06, 0.065, 0.10, cushionDepth - 0.09, dark);
        }
      }
      rowEnds.push(vertices.length / 9);
    }
    return { vertices: new Float32Array(vertices), rowEnds };
  }

  function makeFilmFrame(screen) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 428;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 428);
    sky.addColorStop(0, '#10242d');
    sky.addColorStop(0.55, '#356166');
    sky.addColorStop(1, '#191d20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 428);

    let seed = 8251;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let index = 0; index < 210; index++) {
      const x = random() * 1024, y = random() * 261;
      ctx.fillStyle = `rgba(221,232,222,${0.12 + random() * 0.55})`;
      ctx.fillRect(x, y, index % 17 === 0 ? 2 : 1, 1);
    }
    const glow = ctx.createRadialGradient(740, 150, 19, 740, 150, 150);
    glow.addColorStop(0, '#d2e2b972');
    glow.addColorStop(1, '#d2e2b900');
    ctx.fillStyle = glow;
    ctx.fillRect(570, 0, 340, 325);
    const moon = ctx.createLinearGradient(720, 61, 793, 244);
    moon.addColorStop(0, '#f7e8bd');
    moon.addColorStop(1, '#729e94');
    ctx.beginPath();
    ctx.arc(740, 151, 82, 0, Math.PI * 2);
    ctx.fillStyle = moon;
    ctx.fill();

    function ridge(points, color) {
      ctx.beginPath();
      ctx.moveTo(0, points[0][1]);
      for (const [x, y] of points) ctx.lineTo(x, y);
      ctx.lineTo(1024, 428);
      ctx.lineTo(0, 428);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ridge([[0, 242], [115, 184], [170, 226], [241, 216], [306, 262], [419, 214], [504, 242],
      [616, 222], [659, 258], [767, 227], [852, 253], [960, 185], [1024, 207]], '#406564');
    ridge([[0, 223], [94, 232], [167, 190], [280, 261], [360, 287], [459, 294], [530, 278],
      [625, 305], [725, 292], [805, 266], [888, 228], [1024, 249]], '#28484a');
    ridge([[0, 277], [103, 291], [187, 256], [251, 284], [310, 328], [499, 348], [637, 328],
      [742, 334], [832, 288], [943, 279], [1024, 240]], '#173135');
    ridge([[0, 354], [88, 332], [168, 349], [248, 372], [361, 391], [540, 382],
      [736, 369], [873, 338], [1024, 335]], '#0d2329');
    const surface = document.createElement('canvas');
    surface.width = 1024;
    surface.height = Math.round(surface.width * screen.height / screen.width);
    const projection = surface.getContext('2d');
    projection.fillStyle = '#071012';
    projection.fillRect(0, 0, surface.width, surface.height);
    const imageWidth = surface.width * screen.image.width / screen.width;
    const imageHeight = surface.height * screen.image.height / screen.height;
    const left = (surface.width - imageWidth) / 2;
    const top = (surface.height - imageHeight) / 2;
    const scale = Math.max(imageWidth / canvas.width, imageHeight / canvas.height);
    projection.save();
    projection.beginPath();
    projection.rect(left, top, imageWidth, imageHeight);
    projection.clip();
    projection.drawImage(canvas, (surface.width - canvas.width * scale) / 2,
      (surface.height - canvas.height * scale) / 2, canvas.width * scale, canvas.height * scale);
    projection.fillStyle = '#e9f0d6';
    projection.font = '600 54px Microsoft YaHei, sans-serif';
    projection.fillText('星际回声', left + imageWidth * 0.085, top + imageHeight * 0.43);
    projection.fillStyle = '#d6e8d4';
    projection.font = '500 17px system-ui, sans-serif';
    projection.letterSpacing = '5px';
    projection.fillText('ECHOES OF ORBIT', left + imageWidth * 0.09, top + imageHeight * 0.43 + 37);
    projection.restore();
    projection.font = '500 23px Microsoft YaHei, sans-serif';
    projection.textAlign = 'center';
    projection.textBaseline = 'alphabetic';
    projection.strokeStyle = '#0a1818';
    projection.lineWidth = 4;
    projection.fillStyle = '#f7f4df';
    const cue = '信号来自轨道的另一侧。';
    const subtitleY = surface.height * (1 - (subtitleHeight(screen) - screen.bottom) / screen.height);
    projection.strokeText(cue, surface.width / 2, subtitleY);
    projection.fillText(cue, surface.width / 2, subtitleY);
    return surface;
  }

  function create(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL unavailable');
    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    }
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec3 position;
      attribute vec3 color;
      attribute vec2 uv;
      attribute float textured;
      uniform vec3 eye, right, up, forward;
      uniform vec2 scale;
      varying vec3 tint;
      varying vec2 texCoord;
      varying float useTexture, depthFromSeat;
      void main() {
        vec3 delta = position - eye;
        float depth = dot(delta, forward);
        gl_Position = vec4(dot(delta, right) * scale.x, dot(delta, up) * scale.y,
          depth * 1.0016 - 0.1601, depth);
        tint = color;
        texCoord = uv;
        useTexture = textured;
        depthFromSeat = depth;
      }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D film;
      varying vec3 tint;
      varying vec2 texCoord;
      varying float useTexture, depthFromSeat;
      void main() {
        vec3 base = tint;
        if (useTexture > 0.5) base = texture2D(film, texCoord).rgb;
        float haze = clamp(depthFromSeat * 0.010, 0.0, 0.22);
        gl_FragColor = vec4(mix(base, vec3(0.075, 0.090, 0.078), haze), 1.0);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, size, offset] of [['position', 3, 0], ['color', 3, 3], ['uv', 2, 6], ['textured', 1, 8]]) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset * 4);
    }
    const uniforms = Object.fromEntries(['eye', 'right', 'up', 'forward', 'scale', 'film']
      .map(name => [name, gl.getUniformLocation(program, name)]));
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniforms.film, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.035, 0.046, 0.042, 1);

    let rowEnds;
    let renderedHall;
    let camera;
    const roomAssets = new WeakMap();
    function setHall(hall) {
      if (renderedHall === hall) return;
      if (!roomAssets.has(hall)) roomAssets.set(hall, { mesh: buildRoom(hall), film: makeFilmFrame(hall.screen) });
      const { mesh, film } = roomAssets.get(hall);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, film);
      rowEnds = mesh.rowEnds;
      renderedHall = hall;
    }

    function draw(hall, pose, moving, seat) {
      const { clientWidth, clientHeight } = canvas;
      if (!clientWidth || !clientHeight || gl.isContextLost()) return;
      setHall(hall);
      const displayRatio = window.devicePixelRatio || 1;
      const ratio = moving
        ? Math.min(displayRatio, Math.sqrt(126000 / (clientWidth * clientHeight)))
        : Math.min(1.75, Math.max(1.12, displayRatio));
      const width = Math.max(1, Math.round(clientWidth * ratio));
      const height = Math.max(1, Math.round(clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const { x, y, z, yaw, pitch, lens, zoom, overhead } = pose;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const aspect = clientWidth / clientHeight;
      const magnification = zoom * Math.min(1 / Math.tan(lens / 2), (1.12 - overhead * 0.14) * aspect);
      const pitchSin = Math.sin(pitch), pitchCos = Math.cos(pitch);
      const forward = [sin * pitchCos, pitchSin, -cos * pitchCos];
      const right = [cos, 0, sin];
      const up = [-sin * pitchSin, pitchCos, cos * pitchSin];
      gl.uniform3f(uniforms.eye, x, y, z);
      gl.uniform3f(uniforms.forward, ...forward);
      gl.uniform3f(uniforms.right, ...right);
      gl.uniform3f(uniforms.up, ...up);
      gl.uniform2f(uniforms.scale, magnification / aspect, magnification);
      // A row whose whole bounding box is behind the camera contributes no pixels.
      let visibleRows = hall.rows.length;
      if (forward[2] < -0.01) {
        const horizontalReach = Math.abs(forward[0]) * (hall.width / 2 + Math.abs(x));
        const verticalReach = Math.max(-y * forward[1], (hall.ceiling - y) * forward[1]);
        const backLimit = z - (horizontalReach + verticalReach) / forward[2];
        const firstHidden = hall.rows.findIndex(([seat]) => seat.z - hall.spacing / 2 > backLimit);
        if (firstHidden >= 0) visibleRows = firstHidden;
      }
      gl.drawArrays(gl.TRIANGLES, 0, rowEnds[visibleRows]);
      camera = { hall, eye: [x, y, z], forward, right, up, aspect, magnification, visibleRows };

      if (!seat || overhead < 0.08) return;
      const dx = seat.x - x, dy = seat.floor + 1.16 - y, dz = seat.z + 0.23 - z;
      const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
      if (depth < 0.4) return;
      const horizontal = (dx * cos + dz * sin) * magnification / (aspect * depth);
      const vertical = (dx * up[0] + dy * up[1] + dz * up[2]) * magnification / depth;
      if (Math.abs(horizontal) > 0.93 || Math.abs(vertical) > 0.9) return;
      return { x: (horizontal + 1) * clientWidth / 2, y: (1 - vertical) * clientHeight / 2 };
    }

    function rayDistance(eye, ray, minimum, maximum) {
      let near = 0.08, far = Infinity;
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(ray[axis]) < 1e-7) {
          if (eye[axis] < minimum[axis] || eye[axis] > maximum[axis]) return Infinity;
          continue;
        }
        const a = (minimum[axis] - eye[axis]) / ray[axis];
        const b = (maximum[axis] - eye[axis]) / ray[axis];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (far < near) return Infinity;
      }
      return near;
    }

    function pickSeat(hall, clientX, clientY, ignore) {
      if (!camera || camera.hall !== hall) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { eye, forward, right, up, aspect, magnification, visibleRows } = camera;
      const horizontal = (2 * (clientX - rect.left) / rect.width - 1) * aspect / magnification;
      const vertical = (1 - 2 * (clientY - rect.top) / rect.height) / magnification;
      const ray = forward.map((value, axis) => value + right[axis] * horizontal + up[axis] * vertical);
      let nearest = Infinity, hit;
      const backHalfWidth = hall.pitch * 0.395;
      const cushionHalfWidth = hall.pitch * 0.46;
      for (let index = 0; index < visibleRows; index++) {
        for (const seat of hall.rows[index]) {
          if (seat.id === ignore) continue;
          const back = rayDistance(eye, ray, [seat.x - backHalfWidth, seat.floor + 0.42, seat.z + 0.16],
            [seat.x + backHalfWidth, seat.floor + 1.08, seat.z + 0.45]);
          const cushion = rayDistance(eye, ray, [seat.x - cushionHalfWidth, seat.floor + 0.34, seat.z - 0.38],
            [seat.x + cushionHalfWidth, seat.floor + 0.62, seat.z + 0.23]);
          const distance = Math.min(back, cushion);
          if (distance < nearest) {
            nearest = distance;
            hit = seat;
          }
        }
      }
      return hit;
    }

    return { draw, pickSeat };
  }

  return { halls, sightline, strength, create };
})();
