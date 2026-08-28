class ApiResponse {
  constructor(statuscode, status, message, data) {
    this.statuscode = statuscode;
    this.message = message;
    this.status = status;
    this.data = data ? data : null;
  }
}

export default ApiResponse;
