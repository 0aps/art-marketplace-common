import {StatusCodes} from "http-status-codes";

export class BaseError extends Error {
    constructor(message) {
        super(message);
        this.code = StatusCodes.BAD_REQUEST;
    }

    toClient(){
        return {
            message: this.message,
            code: this.code
        };
    }
}

export class RecordNotFound extends BaseError {
    constructor(message = '') {
        super(message);
        this.message = 'El registro no se ha encontrado. Por favor verificar.';
        this.code = StatusCodes.NOT_FOUND;
    }
}

export class InvalidRequest extends BaseError {
    constructor(message = '') {
        super(message);
    }
}

export class InvalidToken extends BaseError {
    constructor(message = '') {
        super(message);
        this.message = 'El token provisto no es valido. Por favor revisar.';
        this.code = StatusCodes.UNAUTHORIZED;
    }
}

export class ExpiredToken extends BaseError {
    constructor(message = '') {
        super(message);
        this.message = 'El token provisto ha expirado.';
    }
}

export class UserForbidden extends BaseError {
    constructor(message = '') {
        super(message);
        this.message = 'No tienes los permisos de lugar para realizar esta acción.';
        this.code = StatusCodes.FORBIDDEN;
    }
}