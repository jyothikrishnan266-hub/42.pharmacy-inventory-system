const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "pharmacy_inventory_v1";

let medicines = [];

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  medicines = Array.isArray(saved) ? saved : [];
} catch {
  medicines = [];
}

const form = $("medicineForm");
const table = $("medicineTable");

const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
};

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
  } catch {
    alert("Could not save data. Check browser storage availability.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getStatus(medicine) {
  if (medicine.expiry < today()) {
    return { text: "Expired", className: "expired" };
  }

  if (medicine.quantity <= 10) {
    return { text: "Low Stock", className: "low" };
  }

  return { text: "In Stock", className: "good" };
}

function money(amount) {
  return Number(amount).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  });
}

function renderDashboard() {
  $("totalMedicines").textContent = medicines.length;

  $("totalStock").textContent = medicines.reduce(
    (sum, medicine) => sum + Number(medicine.quantity), 0
  );

  $("lowStock").textContent = medicines.filter(
    medicine => medicine.quantity <= 10 &&
                medicine.expiry >= today()
  ).length;

  $("expiredStock").textContent = medicines.filter(
    medicine => medicine.expiry < today()
  ).length;
}

function renderTable() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filter = $("filterStatus").value;

  const filtered = medicines.filter(medicine => {
    const matchesSearch =
      medicine.name.toLowerCase().includes(query) ||
      medicine.batch.toLowerCase().includes(query) ||
      medicine.category.toLowerCase().includes(query);

    const status = getStatus(medicine);

    const matchesFilter =
      filter === "all" ||
      (filter === "low" && status.text === "Low Stock") ||
      (filter === "expired" && status.text === "Expired") ||
      (filter === "valid" && status.text !== "Expired");

    return matchesSearch && matchesFilter;
  });

  table.innerHTML = filtered.map(medicine => {
    const status = getStatus(medicine);

    return `
      <tr>
        <td>${escapeHTML(medicine.name)}</td>
        <td>${escapeHTML(medicine.batch)}</td>
        <td>${escapeHTML(medicine.category)}</td>
        <td>${medicine.quantity}</td>
        <td>${money(medicine.price)}</td>
        <td>${escapeHTML(medicine.expiry)}</td>
        <td>
          <span class="status ${status.className}">
            ${status.text}
          </span>
        </td>
        <td>
          <div class="action-group">
            <button class="action-btn edit-btn"
              data-action="edit" data-id="${medicine.id}">
              Edit
            </button>
            <button class="action-btn delete-btn"
              data-action="delete" data-id="${medicine.id}">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  $("emptyMessage").hidden = filtered.length !== 0;
  $("tableCount").textContent =
    `Showing ${filtered.length} of ${medicines.length} records`;

  renderDashboard();
}

function resetForm() {
  form.reset();
  $("medicineId").value = "";
  $("formTitle").textContent = "Add New Medicine";
  $("saveBtn").textContent = "+ Add Medicine";
  $("cancelEdit").hidden = true;
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const id = $("medicineId").value;
  const quantity = Number($("quantity").value);
  const price = Number($("price").value);
  const expiry = $("expiry").value;

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    !Number.isFinite(price) ||
    price < 0 ||
    !expiry ||
    !["Tablet", "Capsule", "Syrup", "Injection",
      "Ointment", "Other"].includes($("category").value)
  ) {
    alert("Please enter valid medicine details.");
    return;
  }

  const medicine = {
    id: id || (
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2)
    ),
    name: $("name").value.trim(),
    batch: $("batch").value.trim(),
    category: $("category").value,
    quantity,
    price,
    expiry
  };

  if (!medicine.name || !medicine.batch || !expiry) {
    alert("Please fill in all required fields.");
    return;
  }

  // Do not allow duplicate batch numbers for different records.
  const duplicate = medicines.some(item =>
    item.batch.toLowerCase() === medicine.batch.toLowerCase() &&
    item.id !== id
  );

  if (duplicate) {
    alert("This batch number already exists.");
    return;
  }

  if (id) {
    medicines = medicines.map(item =>
      item.id === id ? medicine : item
    );
  } else {
    medicines.push(medicine);
  }

  saveData();
  resetForm();
  renderTable();
  alert(id ? "Medicine updated successfully!" :
             "Medicine added successfully!");
});

$("cancelEdit").addEventListener("click", resetForm);

table.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const medicine = medicines.find(
    item => item.id === button.dataset.id
  );

  if (!medicine) return;

  if (button.dataset.action === "edit") {
    $("medicineId").value = medicine.id;
    $("name").value = medicine.name;
    $("batch").value = medicine.batch;
    $("category").value = medicine.category;
    $("quantity").value = medicine.quantity;
    $("price").value = medicine.price;
    $("expiry").value = medicine.expiry;

    $("formTitle").textContent = "Edit Medicine";
    $("saveBtn").textContent = "Save Changes";
    $("cancelEdit").hidden = false;

    $("medicine-form").scrollIntoView({ behavior: "smooth" });
  }

  if (button.dataset.action === "delete") {
    if (confirm(`Delete ${medicine.name} (batch ${medicine.batch})?`)) {
      medicines = medicines.filter(item => item.id !== medicine.id);
      saveData();
      renderTable();

      if ($("medicineId").value === medicine.id) {
        resetForm();
      }
    }
  }
});

$("searchInput").addEventListener("input", renderTable);
$("filterStatus").addEventListener("change", renderTable);

$("exportBtn").addEventListener("click", () => {
  const headers = [
    "Medicine Name", "Batch Number", "Category",
    "Quantity", "Unit Price", "Expiry Date", "Status"
  ];

  const rows = medicines.map(medicine => [
    medicine.name,
    medicine.batch,
    medicine.category,
    medicine.quantity,
    medicine.price,
    medicine.expiry,
    getStatus(medicine).text
  ]);

  // Quote CSV cells and protect spreadsheet software
  // from interpreting text cells as formulas.
  const csvCell = value => {
    let text = String(value);

    if (/^[\s]*[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pharmacy-inventory.csv";
  link.click();
  URL.revokeObjectURL(url);
});

renderTable();