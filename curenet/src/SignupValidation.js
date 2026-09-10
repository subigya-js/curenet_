function Validation(values) {
    let error = {};
    const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!values.email) {
        error.email = "Email should not be empty";
    }
    else if (!email_pattern.test(values.email)) {
        error.email = "Email doesn't match";
    }

    if (!values.username) {
        error.username = "Name should not be empty";
    }

    if (!values.address) {
        error.address = "Address should not be empty";
    }

    if (!values.gender) {
        error.gender= "Choose gender ";
    }

    if (!values.age) {
        error.age = "Select correct age ";
    }

    if (!values.speciality) {
        error.speciality= "Select correct Speciality ";
    }

    if (!values.password) {
        error.password = "Password should not be empty";
    }

    return error; 
}

export default Validation;
