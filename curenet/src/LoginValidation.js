function Validation(values) {
    let error = {};
    const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!values.email) {
        error.email = "Email should not be empty";
    } else if (!email_pattern.test(values.email)) {
        error.email = "Email doesn't match";
    }

    if (!values.password) {
        error.password = "Password should not be empty";
    }

    return error;  
}

export default Validation;
