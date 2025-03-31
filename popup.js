browser.storage.local.get(["kept", "blocked", "cookies", "logs"]).then(data => {
    document.getElementById("keptCount").textContent = (data.kept || []).length;
    document.getElementById("blockedCount").textContent = (data.blocked || []).length;
    document.getElementById("allowedCount").textContent = (data.cookies || []).length;

    let allowedList = document.getElementById("allowedList");
    (data.cookies || []).forEach(name => {
        let item = document.createElement("li");
        item.textContent = name;
        allowedList.appendChild(item);
    });

    // Add logs to popup
    let logSection = document.createElement("div");
    logSection.className = "section";
    logSection.innerHTML = "<h4>Log</h4><pre>" + (data.logs || []).join("\n") + "</pre>";
    document.body.appendChild(logSection);
});
