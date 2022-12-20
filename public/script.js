const checkValidPhoneNumber = function(input) {
    if(input.value.length < 18) {
        input.classList.add("input_ircorrect");
    } else {
        if(input.classList.contains('input_ircorrect')) {
            input.classList.remove("input_ircorrect");
        }
    }
}

const checkValidName = function(input) {
    if(!!!input.value) {
        input.classList.add("input_ircorrect");
    } else {
        if(input.classList.contains('input_ircorrect')) {
            input.classList.remove("input_ircorrect");
        }
    }
}

const phoneInput = document.querySelector(".form-callBack__phone-number");
const nameInput = document.querySelector(".form-callBack__name")
const form = document.querySelector(".form-callBack");

phoneInput.addEventListener('input', (e) => {
    const target = e.target;
    const value = target.value;

    setTimeout(() => {
        if(value.length === target.value.length || value.length === 3) {
            checkValidPhoneNumber(target);
        }
    }, 420)
});

nameInput.addEventListener('input', (e) => {
    const target = e.target;
    const value = target.value;

    setTimeout(() => {
        if(value.length === target.value.length) {
            checkValidName(target);
        }
    }, 420)
})

const warning = document.querySelector('.warning');

const openWarning = function() {
    warning.classList.add('warning_active');
}

const animateWarning = function(){
    warning.classList.add("warning_animation");
}

const closeWarning = function() {
    warning.classList.remove('warning_active');
    warning.classList.remove('warning_animation')
}


form.addEventListener('submit', (e) => {
    if(!!!nameInput.value || phoneInput.value.length < 18) {
        e.preventDefault();
        openWarning();

        setTimeout(() => {
            animateWarning()

            setTimeout(() => {
                closeWarning()
            }, 410)
        }, 4000
        )
    }
})