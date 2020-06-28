!function(e) {
    var t = {};
    function n(r) {
        if (t[r])
            return t[r].exports;
        var o = t[r] = {
            i: r,
            l: !1,
            exports: {}
        };
        return e[r].call(o.exports, o, o.exports, n),
        o.l = !0,
        o.exports
    }
    n.m = e,
    n.c = t,
    n.d = function(e, t, r) {
        n.o(e, t) || Object.defineProperty(e, t, {
            enumerable: !0,
            get: r
        })
    }
    ,
    n.r = function(e) {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }),
        Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }
    ,
    n.t = function(e, t) {
        if (1 & t && (e = n(e)),
        8 & t)
            return e;
        if (4 & t && "object" == typeof e && e && e.__esModule)
            return e;
        var r = Object.create(null);
        if (n.r(r),
        Object.defineProperty(r, "default", {
            enumerable: !0,
            value: e
        }),
        2 & t && "string" != typeof e)
            for (var o in e)
                n.d(r, o, function(t) {
                    return e[t]
                }
                .bind(null, o));
        return r
    }
    ,
    n.n = function(e) {
        var t = e && e.__esModule ? function() {
            return e.default
        }
        : function() {
            return e
        }
        ;
        return n.d(t, "a", t),
        t
    }
    ,
    n.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t)
    }
    ,
    n.p = "",
    n(n.s = 1)
}([, function(e, t, n) {
    "use strict";
    n.r(t);
    const r = {
        toolbar: {
            undo: "Deshacer",
            redo: "Rehacer",
            print: "Imprimir",
            paintformat: "Copiar formato",
            clearformat: "Quitar formato",
            format: "Formato",
            fontName: "Fuente",
            fontSize: "Tamaño de fuente",
            fontBold: "Fuente negrita",
            fontItalic: "Fuente cursiva",
            underline: "Subrayado",
            strike: "Tachado",
            color: "Color de texto",
            bgcolor: "Color de relleno",
            border: "Bordes",
            merge: "Combinar celdas",
            align: "Alinear horizontalmente",
            valign: "Alinear verticalmente",
            textwrap: "Ajuste de texto",
            freeze: "Bloquear la celda",
            autofilter: "Filtrar",
            formula: "Fórmulas",
            more: "Mas"
        },
        contextmenu: {
            copy: "Copiar",
            cut: "Cortar",
            paste: "Pegar",
            pasteValue: "Pegar sólo valores",
            pasteFormat: "Pegar sólo formato",
            hide: "Ocultar",
            insertRow: "Insertar fila",
            insertColumn: "Insertar columna",
            deleteSheet: "Eliminar",
            deleteRow: "Eliminar fila",
            deleteColumn: "Eliminar columna",
            deleteCell: "Eliminar celda",
            deleteCellText: "Eliminar texto de celda",
            validation: "Validaciones de datos",
            cellprintable: "Habilitar exportación",
            cellnonprintable: "Desactivar exportación",
            celleditable: "Habilitar edición",
            cellnoneditable: "Desactivar edición"
        },
        print: {
            size: "Tamaño de papel",
            orientation: "Orientación de la página",
            orientations: ["Paisaje", "Retrato"]
        },
        format: {
            normal: "Normal",
            text: "Texto Plano",
            number: "Número",
            percent: "Por ciento",
            rmb: "RMB",
            usd: "USD",
            eur: "EUR",
            date: "Fecha",
            time: "Hora",
            datetime: "Fecha y hora",
            duration: "Duración"
        },
        formula: {
            sum: "Suma",
            average: "Average",
            max: "Promedio",
            min: "Min",
            _if: "IF",
            and: "AND",
            or: "OR",
            concat: "Concatenar"
        },
        validation: {
            required: "debe ser requerido",
            notMatch: "no coincide con su regla de validación",
            between: "está entre {} y {}",
            notBetween: "no está entre {} y {}",
            notIn: "no está en la lista",
            equal: "es igual a {}",
            notEqual: "no es igual a {}",
            lessThan: "menos de {}",
            lessThanEqual: "es menor o igual que {}",
            greaterThan: "es mayor que {}",
            greaterThanEqual: "es mayor o igual que {}"
        },
        error: {
            pasteForMergedCell: "No se puede hacer esto para las celdas combinadas"
        },
        calendar: {
            weeks: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
            months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        },
        button: {
            next: "Siguiente",
            cancel: "Cancelar",
            remove: "Borrar",
            save: "Guardar",
            ok: "Aceptar"
        },
        sort: {
            desc: "Ordenar desde Z -> A",
            asc: "Ordenar desde A -> Z"
        },
        filter: {
            empty: "vacío"
        },
        dataValidation: {
            mode: "Modo",
            range: "Rango de celdas",
            criteria: "Criterios",
            modeType: {
                cell: "Celda",
                column: "Columna",
                row: "Fila"
            },
            type: {
                list: "Lista",
                number: "Número",
                date: "Fecha",
                phone: "Teléfono",
                email: "Correo electrónico"
            },
            operator: {
                be: "entre",
                nbe: "no entre",
                lt: "menor que",
                lte: "menor o igual a",
                gt: "mayor que",
                gte: "mayor igual a",
                eq: "igual a",
                neq: "diferente a"
            }
        }
    };
    window && window.x_spreadsheet && (window.x_spreadsheet.$messages = window.x_spreadsheet.$messages || {},
    window.x_spreadsheet.$messages["es"] = r),
    t.default = r
}
]);
