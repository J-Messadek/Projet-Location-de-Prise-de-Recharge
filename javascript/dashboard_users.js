// tout en haut du fichier
const API_BASE = "https://api.recharge.cielnewton.fr";

document.addEventListener("DOMContentLoaded", function () {
  let currentKwhPrice = 0;

  // Récupérer les éléments du DOM
  const montantEurosInput = document.getElementById("montant-euros");
  const montantKwhInput   = document.getElementById("montant-kwh");
  const prixKwhAffiche    = document.getElementById("prix-kwh-affiche");

  // 1) Récupérer le prix actuel du kWh
  function updateKwhPrice() {
    fetch(`${API_BASE}/get-current-kwh-price`, {
      method: "GET",
      credentials: "include",
    })
      .then((response) => response.text())
      .then((text) => {
        try {
          const data = JSON.parse(text);
          currentKwhPrice = parseFloat(data.prix_kwh);
          prixKwhAffiche.innerText = isNaN(currentKwhPrice)
            ? "Erreur : Prix invalide"
            : currentKwhPrice.toFixed(2);
        } catch {
          prixKwhAffiche.innerText = "Erreur de format";
        }
      })
      .catch(() => {
        prixKwhAffiche.innerText = "Erreur de connexion";
      });
  }

  // 2) Synchro € ↔ kWh
  montantEurosInput.addEventListener("input", () => {
    const m = parseFloat(montantEurosInput.value);
    montantKwhInput.value = !isNaN(m) && currentKwhPrice > 0
      ? (m / currentKwhPrice).toFixed(2)
      : "";
  });
  montantKwhInput.addEventListener("input", () => {
    const k = parseFloat(montantKwhInput.value);
    montantEurosInput.value = !isNaN(k) && currentKwhPrice > 0
      ? (k * currentKwhPrice).toFixed(2)
      : "";
  });

  updateKwhPrice();

  // 3) Bouton PayPal
  paypal.Buttons({
    createOrder(data, actions) {
      const montant = parseFloat(montantEurosInput.value);
      if (isNaN(montant) || montant <= 0) {
        alert("Veuillez saisir un montant en euros valide.");
        return;
      }
      return actions.order.create({ purchase_units:[{amount:{value:montant.toFixed(2)}}] });
    },
    onApprove(data, actions) {
      return actions.order.capture().then((details) => {
        alert("Transaction réussie pour : " + details.payer.name.given_name);
        const kwhAchat = parseFloat(montantKwhInput.value);
        if (isNaN(kwhAchat) || kwhAchat <= 0) {
          alert("Erreur dans le montant des kWh.");
          return;
        }
        fetch(`${API_BASE}/update-credits`, {
          method: "POST",
          credentials: "include",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ kwh: kwhAchat }),
        })
          .then((r)=>r.json())
          .then((d)=>{
            if (d.message.includes("succès")) fetchCredits();
            else alert("Erreur lors de la mise à jour des crédits.");
          });
      });
    },
    onError(err){ console.error("Erreur PayPal :",err); },
  }).render("#paypal-button-container");

  // 4) Charger l’historique et les crédits
  chargerHistorique();
  chargerCredits();
});

// Récupère et affiche les crédits
function fetchCredits() {
  fetch(`${API_BASE}/get-user-info-credits`, { method:"GET", credentials:"include" })
    .then((r)=>r.json())
    .then((d)=>{
      document.getElementById("credits-restant").innerText = d.credits + " kWh";
      document.getElementById("total-paid"   ).innerText = d.totalPaid + " €";
    });
}

// Charge les crédits (idem)
function chargerCredits() {
  fetch(`${API_BASE}/get-user-info-credits`, { method:"GET", credentials:"include" })
    .then((r)=>{
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((d)=>{
      document.getElementById("credits-restant").innerText = d.credits + " kWh";
    })
    .catch(()=>{
      document.getElementById("credits-restant").innerText = "Erreur de chargement";
    });
}

// Charge l’historique
function chargerHistorique() {
  fetch("https://api.recharge.cielnewton.fr/historique-consommation", {
    method: "GET",
    credentials: "include",
  })
    .then((response) => {
      if (!response.ok)
        throw new Error("Erreur lors de la récupération de l'historique.");
      return response.json();
    })
    .then((data) => {
      const tbody = document
        .getElementById("historyTable")
        .querySelector("tbody");
      tbody.innerHTML = "";

      if (data.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="6">Aucun historique disponible.</td>';
        tbody.appendChild(row);
      } else {
        data.forEach((record) => {
          const row = document.createElement("tr");
          row.innerHTML = `
          <td>${record.id_prise}</td>
          <td>${record.puissance_consomme}</td>
          <td>${record.temps_utilise}</td>
          <td>${record.energie_consomme}</td>
          <td>${record.prix_de_reference}</td>
          <td>${new Date(record.date_enregistrement).toLocaleString()}</td>
        `;
          tbody.appendChild(row);
        });
      }
    })
    .catch((error) => {
      console.error("Erreur:", error);
      const tbody = document
        .getElementById("historyTable")
        .querySelector("tbody");
      tbody.innerHTML =
        '<tr><td colspan="6">Erreur lors du chargement des données.</td></tr>';
    });
}


// Formulaire de contact…
document.getElementById("contact-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const subject = document.getElementById("subject").value;
  const message = document.getElementById("message").value;
  const res = await fetch(`${API_BASE}/contact`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, message }),
  });
  const data = await res.json();
  document.getElementById("response-message").textContent = data.message;
});

// Gestion des onglets (inchangé)
function openTab(tabId, ev) {
  document.querySelectorAll(".tab-content").forEach(d=>d.classList.remove("active"));
  document.querySelectorAll(".tablink"   ).forEach(b=>b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  ev.currentTarget.classList.add("active");
}

// Toggle premium controls…
let fontSizePct = 100;
document.getElementById("increase-text").onclick = ()=>{ fontSizePct+=10; document.documentElement.style.fontSize=fontSizePct+"%"; };
document.getElementById("decrease-text").onclick = ()=>{ fontSizePct=Math.max(50,fontSizePct-10); document.documentElement.style.fontSize=fontSizePct+"%"; };
document.getElementById("toggle-theme").onclick = ()=>document.body.classList.toggle("dark");

// Vérification & toggle prise
async function verifyAndToggle(id, action) {
  // 1) scan
  const scanRes = await fetch(`${API_BASE}/api/scan`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id_prise:id})
  });
  if (!scanRes.ok) {
    const err = await scanRes.text();
    return { ok:false, msg:`Prise inconnue : ${err}` };
  }
  // 2) on/off
  const endpoint = action==="on" ? "/allumer-prise" : "/eteindre-prise";
  const toggleRes = await fetch(`${API_BASE}${endpoint}`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id_prise:id})
  });
  if (!toggleRes.ok) {
    const err = await toggleRes.text().catch(()=>toggleRes.statusText);
    return { ok:false, msg:`Erreur action: ${err}` };
  }
  // 3) retour
  if (action==="on") {
    return { ok:true, msg:`✅ Prise ${id} allumée` };
  } else {
    const json = await toggleRes.json().catch(()=>null);
    const creditsMsg = json?.newCredits!=null ? `, crédits restants: ${json.newCredits}` : "";
    // on rafraîchit l’historique
    chargerHistorique();
    return { ok:true, msg:`✅ Prise ${id} éteinte${creditsMsg}` };
  }
}

// boutons prise
document.getElementById("btn-on").onclick = async () => {
  const id = document.getElementById("id_prise").value.trim();
  if (!id) return alert("Renseignez un ID de prise");
  const {ok,msg} = await verifyAndToggle(id,"on");
  document.getElementById("controle-message").textContent = msg;
};
document.getElementById("btn-off").onclick = async () => {
  const id = document.getElementById("id_prise").value.trim();
  if (!id) return alert("Renseignez un ID de prise");

  const { ok, msg } = await verifyAndToggle(id, "off");
  document.getElementById("controle-message").textContent = msg;

  if (ok) {
    // Rafraîchir l'historique après extinction réussie
    chargerHistorique();
  }
};
