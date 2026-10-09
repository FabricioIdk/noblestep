 
(function () {
  'use strict';

  document.addEventListener('click', function (evento) {
    var destino = evento.target.closest('[data-href]');
    if (destino) {
      if (destino.hasAttribute('data-cerrar-ventana')) window.close();
      window.location.href = destino.getAttribute('data-href');
      return;
    }
    if (evento.target.closest('[data-volver]')) {
      window.history.back();
      return;
    }

    var botonPaso = evento.target.closest('[data-paso]');
    if (botonPaso) {
      var formularioCantidad = botonPaso.closest('form');
      var campoCantidad = formularioCantidad && formularioCantidad.querySelector('input[type="number"]');
      if (campoCantidad) {
        var minimo = parseInt(campoCantidad.min || '1', 10);
        var maximo = campoCantidad.max ? parseInt(campoCantidad.max, 10) : Infinity;
        var actual = parseInt(campoCantidad.value, 10) || minimo;
        var siguiente = actual + parseInt(botonPaso.getAttribute('data-paso'), 10);
        siguiente = Math.max(minimo, Math.min(maximo, siguiente));
        if (siguiente !== actual) {
          campoCantidad.value = siguiente;
          formularioCantidad.submit();
        }
      }
      return;
    }

    var botonMenu = evento.target.closest('[data-toggle-menu]');
    if (botonMenu) {
      var abierto = document.body.classList.toggle('menu-movil-abierto');
      botonMenu.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      var iconoAbrir = botonMenu.querySelector('[data-icono-abrir]');
      var iconoCerrar = botonMenu.querySelector('[data-icono-cerrar]');
      if (iconoAbrir) iconoAbrir.style.display = abierto ? 'none' : '';
      if (iconoCerrar) iconoCerrar.style.display = abierto ? '' : 'none';
      return;
    }

    if (document.body.classList.contains('menu-movil-abierto') && evento.target.closest('#navCategorias a')) {
      document.body.classList.remove('menu-movil-abierto');
    }
  });

  document.addEventListener('submit', function (evento) {
    var formulario = evento.target;
    if (formulario.hasAttribute && formulario.hasAttribute('data-confirm')) {
      if (!window.confirm(formulario.getAttribute('data-confirm'))) {
        evento.preventDefault();
      }
    }
  });

  document.addEventListener('change', function (evento) {
    var campo = evento.target;
    if (campo.hasAttribute && campo.hasAttribute('data-autoenviar') && campo.form) {
      campo.form.submit();
    }
  });
})();
