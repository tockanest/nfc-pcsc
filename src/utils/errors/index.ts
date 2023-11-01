class BaseError extends Error {
    public code: string;
    public previousError?: string;

    constructor(code: string, message?: string, previousError?: string) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;

        if (!message && previousError) {
            this.message = `${code}-(PREV): ${previousError}`;
        }

        this.code = code;

        if (previousError) {
            this.previousError = previousError;
        }
    }
}

const createErrorClass = (className: string) => {
    return class extends BaseError {
        constructor(code: string, message?: string, previousError?: string) {
            super(code, message, previousError);
            this.name = className;
        }
    };
};

const TransmitError = createErrorClass("TransmitError");
const ControlError = createErrorClass("ControlError");
const ReadError = createErrorClass("ReadError");
const WriteError = createErrorClass("WriteError");
const LoadAuthenticationKeyError = createErrorClass(
    "LoadAuthenticationKeyError"
);
const AuthenticationError = createErrorClass("AuthenticationError");
const ConnectError = createErrorClass("ConnectError");
const DisconnectError = createErrorClass("DisconnectError");
const GetUIDError = createErrorClass("GetUIDError");

const ERRORS = {
    UNKNOWN_ERROR: "unknown_error",
    FAILURE: "failure",
    CARD_NOT_CONNECTED: "card_not_connected",
    OPERATION_FAILED: "operation_failed",
};

export {
    BaseError,
    TransmitError,
    ControlError,
    ReadError,
    WriteError,
    LoadAuthenticationKeyError,
    AuthenticationError,
    ConnectError,
    DisconnectError,
    GetUIDError,
    ERRORS,
};
