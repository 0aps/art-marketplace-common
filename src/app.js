import express, {Router} from 'express';
import morgan from 'morgan';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import {StatusCodes} from 'http-status-codes';
import {Auth} from './authorization.js';
import {InvalidToken, ExpiredToken, UserForbidden} from './exceptions.js';

class App {
    constructor({server, env, logger, router, storage}) {
        this.server = server;
        this.env = env;
        this.logger = logger;
        this.router = router;
        this.storage = storage;
    }

    static create(params) {
        const server = params.express ?? express();
        const source = params.mongoose ?? mongoose;
        const env = process.env;
        return new App({
            server: server,
            env: env,
            logger: console,
            router: new RouteManager(server),
            storage: new StorageManager({
                source, env
            })
        });
    }

    async start(params) {
        try {
            await this._loadDependencies(params);
            await this._startServer();
        } catch (e) {
            this.logger.error(e);
        }
    }

    async close() {
        if (this.instance) {
            await this.instance.close();
        }
        await this.storage.close();
    }

    async _startServer() {
        this.instance = await this.server.listen(this.env.PORT);
        this.instance.setTimeout(parseInt(this.env.SERVER_TIMEOUT));
        this.logger.info(`Service ${this.env.NAME} started successfully on port ${this.env.PORT}`);
    }

    async _loadDependencies({views}) {
        this.router.load(views);
        await this.storage.start();
        this.logger.info(`Database ${this.env.NAME} started successfully`);
    }
}

class RouteManager {
    constructor(server) {
        this.server = server;
        this.base = '/api';
        this.version = 'v1';
        this.url = this.getBaseRoute();
    }

    load(views) {
        let self = this;
        this.server.locals.apiRoute = this.url;
        this.server.use(morgan('combined'));
        this.server.use(bodyParser.urlencoded({extended: false}));
        this.server.use(bodyParser.json());

        views.forEach((view) => {
            if ('url' in view) {
                let url = self.getBaseRoute(view['version']);
                this.server.use(`${url}${view['url']}`, self._loadParentView(view));
            }
        });
        this.server.use((err, req, res, next) => {
            if (err.code) {
                res.status(err.code).json(err.toClient());
            } else {
                res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(err.message);
            }
        });
        this.server.use((req, res) => {
            res.sendStatus(StatusCodes.NOT_FOUND);
        });
    }

    getBaseRoute(version) {
        return `${this.base}/${version ?? this.version}`;
    }

    getAuthMiddleware({access, roles}) {
        return async (req, res, next) => {
            const method = req.method.toLowerCase();
            if (access === 'public' || typeof access === 'object' && method in access && access[method] === 'public') {
                return next();
            } else {
                let token = req.session && req.session.token;
                if (!token && req.headers.authorization) {
                    token = req.headers.authorization.substring(7);
                }
                try {
                    const valid = await Auth.verify(token);
                    this.server.locals.user = valid;
                    if (roles) {
                        return ((Array.isArray(roles) && roles.includes(valid.role))
                            || typeof roles === 'object' && method in roles && roles[method].includes(valid.role)) ?
                            next() : next(new UserForbidden);
                    } else {
                        return next();
                    }
                } catch (err) {
                    if (err.message === 'jwt expired') {
                        if (req.session != null) {
                            req.session.token = null;
                        }
                        return next(new ExpiredToken());
                    } else {
                        return next(new InvalidToken());
                    }
                }
            }
        }
    }

    _loadParentView(view) {
        const self = this;
        const router = new Router();
        if ('methods' in view) {
            this._loadRouteMethods(router, {...view, url: '/'});
        }

        if ('children' in view) {
            Object.entries(view['children']).forEach(([key, value]) => {
                if ('methods' in value) {
                    this._loadRouteMethods(router, value);
                }

                if ('children' in value) {
                    Object.entries(value['children']).forEach(([$key, $value]) => {
                        const path = `${value['url']}/${$key}`
                        router.use(path, self._loadParentView($value));
                    });
                }
            });
        }

        return router;
    }

    _loadRouteMethods(router, view) {
        const path = view['url'];
        const access = this.getAuthMiddleware(view);
        Object.entries(view['methods']).forEach(([$key, $value]) => router[$key](path, access, $value));
    }
}

class StorageManager {
    constructor({source, env}) {
        this.env = env;
        this.source = source;
    }

    start() {
        return this.source.connect(this.env.DB_URI);
    }

    close() {
        return this.source.connection.close();
    }
}

export {App};