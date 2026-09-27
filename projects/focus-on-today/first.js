const checkBoxList = document.querySelectorAll(".manual-checkbox");
const inputFields = document.querySelectorAll(".goal-input");
const progressBar = document.querySelector(".progress-bar");
const progressValue = document.querySelector(".progress-value");
const resetBtn = document.querySelector(".reset-btn");

// Checkbox Click
checkBoxList.forEach((checkbox) => {

    checkbox.addEventListener("click", () => {

        const allGoalsAdded = [...inputFields].every(input =>
            input.value.trim() !== ""
        );

        if (!allGoalsAdded) {

            progressBar.classList.add("show-error");
            return;

        }

        progressBar.classList.remove("show-error");

        checkbox.parentElement.classList.toggle("completed");

        const completedGoals =
            document.querySelectorAll(".completed").length;

        const progress =
            (completedGoals / inputFields.length) * 100;

        progressValue.style.width = `${progress}%`;

        progressValue.innerText =
            `${completedGoals}/${inputFields.length} Completed`;

    });

});

// Hide Error
inputFields.forEach((input) => {

    input.addEventListener("focus", () => {

        progressBar.classList.remove("show-error");

    });

});

// Reset Button
resetBtn.addEventListener("click", () => {

    const confirmReset = confirm("Are you sure you want to reset all goals?");

    if (!confirmReset) return;

    inputFields.forEach((input) => {

        input.value = "";

    });

    document.querySelectorAll(".goal-container").forEach((goal) => {

        goal.classList.remove("completed");

    });

    progressValue.style.width = "0%";

    progressValue.innerText = "0/3 Completed";

    progressBar.classList.remove("show-error");

});