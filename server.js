const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'electro-task-manager-dev-secret';

const users = [
  {
    id: 'user_1',
    name: 'Hatem Elbadwy',
    email: 'demo@electro.dev',
    password: 'Password123',
  },
];

const projects = [
  {
    id: 'project_1',
    title: 'Mobile App Redesign',
    description: 'Refresh the Flutter task manager screens and navigation flow.',
    status: 'inProgress',
    ownerId: 'user_1',
    createdAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 'project_2',
    title: 'API Integration',
    description: 'Connect authentication, projects, and task updates to the REST API.',
    status: 'pending',
    ownerId: 'user_1',
    createdAt: '2026-06-21T10:30:00.000Z',
  },
  {
    id: 'project_3',
    title: 'Interview Submission',
    description: 'Prepare README, screenshots, APK, and final implementation notes.',
    status: 'done',
    ownerId: 'user_1',
    createdAt: '2026-06-22T14:15:00.000Z',
  },
];

const tasks = [
  {
    id: 'task_1',
    projectId: 'project_1',
    title: 'Implement login validation UI',
    status: 'done',
    priority: 'high',
    createdAt: '2026-06-20T09:30:00.000Z',
  },
  {
    id: 'task_2',
    projectId: 'project_1',
    title: 'Build reusable project card',
    status: 'inProgress',
    priority: 'medium',
    createdAt: '2026-06-20T11:00:00.000Z',
  },
  {
    id: 'task_3',
    projectId: 'project_1',
    title: 'Add empty and error states',
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-06-20T13:10:00.000Z',
  },
  {
    id: 'task_4',
    projectId: 'project_2',
    title: 'Create Dio API service',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-06-21T11:00:00.000Z',
  },
  {
    id: 'task_5',
    projectId: 'project_2',
    title: 'Persist token securely',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-06-21T12:40:00.000Z',
  },
  {
    id: 'task_6',
    projectId: 'project_3',
    title: 'Write setup instructions',
    status: 'done',
    priority: 'low',
    createdAt: '2026-06-22T15:00:00.000Z',
  },
];

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body is too large'));
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (_) {
        reject(new Error('Invalid JSON body'));
      }
    });
  });
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${encodedPayload}`)
    .digest('base64url');

  return `${header}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const decoded = JSON.parse(json);
    if (decoded.exp && Date.now() / 1000 > decoded.exp) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function createAuthResponse(user) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });

  return {
    token,
    user: publicUser(user),
  };
}

function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;
  return users.find((user) => user.id === payload.sub) || null;
}

function requireAuth(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, {
      message: 'Unauthorized. Send a valid Bearer token.',
    });
    return null;
  }
  return user;
}

function projectTaskSummary(projectId) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  return {
    total: projectTasks.length,
    done: projectTasks.filter((task) => task.status === 'done').length,
    pending: projectTasks.filter((task) => task.status === 'pending').length,
    inProgress: projectTasks.filter((task) => task.status === 'inProgress').length,
  };
}

function projectDto(project) {
  return {
    ...project,
    taskSummary: projectTaskSummary(project.id),
  };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRequiredString(value, field, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors[field] = `${field} is required`;
    return '';
  }
  return value.trim();
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const path = url.pathname;

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (method === 'GET' && path === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'electro-task-manager-api',
    });
    return;
  }

  if (method === 'POST' && path === '/api/auth/register') {
    const body = await readBody(req);
    const errors = {};
    const name = validateRequiredString(body.name, 'name', errors);
    const email = validateRequiredString(body.email, 'email', errors).toLowerCase();
    const password = validateRequiredString(body.password, 'password', errors);

    if (email && !isValidEmail(email)) errors.email = 'email must be valid';
    if (password && password.length < 6) errors.password = 'password must be at least 6 characters';
    if (users.some((user) => user.email === email)) errors.email = 'email is already registered';

    if (Object.keys(errors).length) {
      sendJson(res, 422, { message: 'Validation failed', errors });
      return;
    }

    const user = {
      id: `user_${users.length + 1}`,
      name,
      email,
      password,
    };
    users.push(user);
    sendJson(res, 201, createAuthResponse(user));
    return;
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = users.find((item) => item.email === email && item.password === password);

    if (!user) {
      sendJson(res, 401, {
        message: 'Invalid email or password',
      });
      return;
    }

    sendJson(res, 200, createAuthResponse(user));
    return;
  }

  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  if (method === 'GET' && path === '/api/me') {
    sendJson(res, 200, {
      user: publicUser(currentUser),
    });
    return;
  }

  if (method === 'GET' && path === '/api/projects') {
    const status = url.searchParams.get('status');
    const userProjects = projects
      .filter((project) => project.ownerId === currentUser.id)
      .filter((project) => !status || project.status === status)
      .map(projectDto);

    sendJson(res, 200, {
      data: userProjects,
    });
    return;
  }

  if (method === 'POST' && path === '/api/projects') {
    const body = await readBody(req);
    const errors = {};
    const title = validateRequiredString(body.title, 'title', errors);
    const description = validateRequiredString(body.description, 'description', errors);
    const status = String(body.status || 'pending');

    if (!['pending', 'inProgress', 'done'].includes(status)) {
      errors.status = 'status must be pending, inProgress, or done';
    }

    if (Object.keys(errors).length) {
      sendJson(res, 422, { message: 'Validation failed', errors });
      return;
    }

    const project = {
      id: `project_${projects.length + 1}`,
      title,
      description,
      status,
      ownerId: currentUser.id,
      createdAt: new Date().toISOString(),
    };

    projects.unshift(project);
    sendJson(res, 201, {
      data: projectDto(project),
    });
    return;
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (method === 'GET' && projectMatch) {
    const project = projects.find(
      (item) => item.id === projectMatch[1] && item.ownerId === currentUser.id,
    );

    if (!project) {
      sendJson(res, 404, { message: 'Project not found' });
      return;
    }

    sendJson(res, 200, {
      data: projectDto(project),
    });
    return;
  }

  const projectTasksMatch = path.match(/^\/api\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    const project = projects.find(
      (item) => item.id === projectTasksMatch[1] && item.ownerId === currentUser.id,
    );

    if (!project) {
      sendJson(res, 404, { message: 'Project not found' });
      return;
    }

    if (method === 'GET') {
      sendJson(res, 200, {
        data: tasks.filter((task) => task.projectId === project.id),
      });
      return;
    }

    if (method === 'POST') {
      const body = await readBody(req);
      const errors = {};
      const title = validateRequiredString(body.title, 'title', errors);
      const priority = String(body.priority || 'medium');
      const status = String(body.status || 'pending');

      if (!['low', 'medium', 'high'].includes(priority)) {
        errors.priority = 'priority must be low, medium, or high';
      }

      if (!['pending', 'inProgress', 'done'].includes(status)) {
        errors.status = 'status must be pending, inProgress, or done';
      }

      if (Object.keys(errors).length) {
        sendJson(res, 422, { message: 'Validation failed', errors });
        return;
      }

      const task = {
        id: `task_${tasks.length + 1}`,
        projectId: project.id,
        title,
        status,
        priority,
        createdAt: new Date().toISOString(),
      };
      tasks.unshift(task);
      sendJson(res, 201, {
        data: task,
      });
      return;
    }
  }

  const doneTaskMatch = path.match(/^\/api\/tasks\/([^/]+)\/done$/);
  if (method === 'PATCH' && doneTaskMatch) {
    const task = tasks.find((item) => item.id === doneTaskMatch[1]);
    const project = task ? projects.find((item) => item.id === task.projectId) : null;

    if (!task || !project || project.ownerId !== currentUser.id) {
      sendJson(res, 404, { message: 'Task not found' });
      return;
    }

    task.status = 'done';
    sendJson(res, 200, {
      data: task,
    });
    return;
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === 'PATCH' && taskMatch) {
    const task = tasks.find((item) => item.id === taskMatch[1]);
    const project = task ? projects.find((item) => item.id === task.projectId) : null;

    if (!task || !project || project.ownerId !== currentUser.id) {
      sendJson(res, 404, { message: 'Task not found' });
      return;
    }

    const body = await readBody(req);
    const nextStatus = body.status ? String(body.status) : task.status;
    const nextPriority = body.priority ? String(body.priority) : task.priority;

    if (!['pending', 'inProgress', 'done'].includes(nextStatus)) {
      sendJson(res, 422, {
        message: 'Validation failed',
        errors: { status: 'status must be pending, inProgress, or done' },
      });
      return;
    }

    if (!['low', 'medium', 'high'].includes(nextPriority)) {
      sendJson(res, 422, {
        message: 'Validation failed',
        errors: { priority: 'priority must be low, medium, or high' },
      });
      return;
    }

    if (typeof body.title === 'string' && body.title.trim()) {
      task.title = body.title.trim();
    }
    task.status = nextStatus;
    task.priority = nextPriority;

    sendJson(res, 200, {
      data: task,
    });
    return;
  }

  sendJson(res, 404, {
    message: 'Route not found',
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 400, {
      message: error.message || 'Bad request',
    });
  });
});

server.listen(PORT, () => {
  console.log(`Electro Task Manager API running on http://localhost:${PORT}`);
  console.log('Demo login: demo@electro.dev / Password123');
});
