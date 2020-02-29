import { format } from 'fecha';
import csvtojson from 'csvtojson';
import jsonexport from 'jsonexport/dist';
import readXlsxFile from 'read-excel-file';

const BackupHandler = () => {

  const Notify = (props) => {
    const title = props.title || '';
    const msg = props.msg || '';
    const icon = props.icon || '';
    if (!Notification || location.protocol !== 'https') {
      alert(title);
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function (permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
          new Notification(title, {
            icon: icon,
            body: msg
          });
        }
      });
    }

    new Notification(title, {
      icon: icon,
      body: msg
    });
  }

  const csvStringify = (obj) => {
    const rowIndexes = Object.keys(obj.rows)
    const lastRowIndex = parseInt(rowIndexes[rowIndexes.length - 1])
    const grid = []
    // fill empty lines to make valid array
    for(var i = 0; i <= lastRowIndex; i++) {
      if(rowIndexes.includes(i.toString())) {
        grid.push(obj.rows[i.toString()])
      } else {
        grid.push({})
      }
    }

    // find the largest column index which is used
    let largestColumnIndex = 0

    grid.forEach((row => {
      if(!row.cells) return
      const allKeys = Object.keys(row.cells)
      const currValue = allKeys[allKeys.length - 1]
      largestColumnIndex = currValue > largestColumnIndex ? currValue : largestColumnIndex 
    }))

    // assamble the csv string with every row
    let csvString = ``

    grid.forEach(row => {
      for (let i = 0; i <= largestColumnIndex; i++) {
        if(row.cells && row.cells[i]) {
          csvString += row.cells[i].text
        }
        if(i < largestColumnIndex) {
          csvString += `,`
        }
      }
      csvString += `\n`
    })

    return csvString
  }

  const getDownloadName = ({fileType = 'json'} = {}) => {
    const date = format(new Date(), 'YYYY-MM-DD_HH-mm');
    return date + '__x-sheet-backup.' + fileType;
  }

  const getDownloadButtonHrefValue = ({state, useJson = true}) => {
    // https://stackoverflow.com/questions/15069348/create-hyperlink-to-csv-file-and-use-application-to-open-file
    return useJson
     ? 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state))
     : 'data:csv/json;charset=utf-8,' + encodeURIComponent(csvStringify(state))
  }

  const importBackupFile = ({file, xs, state, debug = false}) => {
    var data = event.target.dataset;

    const icon = 'https://fonts.gstatic.com/s/i/materialicons/error/v6/24px.svg';

    debug && console.log('fileType:', file.type)
    const validFileTypes = [
      'application/json',
      'text/csv',
      // 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if(validFileTypes.includes(file.type) === false) {
      Notify({
        title: 'This is not a JSON or CVS or Excel file',
        icon
      });
      return;
    }
    
    if (typeof window.FileReader !== 'function') {
      Notify({
        title: 'The file API isn\'t supported.',
        msg: 'Can\'t import the backup, sorry!',
        icon
      });
      return;
    }

    var fr = new FileReader();

    fr.readAsText(file);
    fr.onload = (e) => {
      const result = e.target.result
      let newState = { rows: {}}

      if(file.type === 'application/json' ) {
        newState = JSON.parse(result)

        if(typeof newState.rows === 'undefined') {
          Notify({
            title: 'This is not a valid backup file',
            msg: 'no attribute "rows" has been found',
            icon
          });
          return;
        }
        state = newState;
        xs.loadData(state);
      } else if (file.type === 'text/csv') {
        csvtojson().fromString(result).then(json => {
          // add Header
          newState.freeze = 'A2';
          newState.rows[0] = {
            'cells': Object.keys(json[0]).map(value => {return {'text': value}})
          }

          // add Values
          json.map( (obj, i) => {
            newState.rows[i + 1] = {
              'cells': Object.values(obj).map(value => {return {'text': value}})
            }
          });

          state = newState;
          xs.loadData(state);
        });
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        readXlsxFile(file).then((rows) => {
          rows.map((row, rowIndex) => {
            row.map((columnVal, columnIndex) => {
              if(newState.rows[rowIndex]) {
                newState.rows[rowIndex].cells[columnIndex] = {text: columnVal.toString()}
              } else {
                // if rowIndex not exist, create it
                newState.rows[rowIndex] = {cells: {[columnIndex]: {text: columnVal.toString()}}}
              }
            });
          });
        });

        state = newState
        xs.loadData(newState)
      }
    };
  }

  return {
    getDownloadName,
    getDownloadButtonHrefValue,
    importBackupFile
  }
}

export default BackupHandler;
