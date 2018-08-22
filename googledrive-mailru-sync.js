var from_upload_folder = '';
var to_upload_folder = '';
var username_mailru = '';
var password_mailru = '';
var isRemoveAfterUpload = true;

var _lastRuning;

//Начальная функция задания
function run() {
  var userProperties = PropertiesService.getUserProperties();
  _lastRuning = userProperties.getProperty('last_runing') || new Date(1900,0,1);
  userProperties.setProperty('last_runing', new Date());
  
  var folders = DriveApp.getFoldersByName(from_upload_folder);
  if (folders.hasNext()) {
    uploadFiles(folders.next());
  }
}

function uploadFiles(folder) {
  var files = folder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    if (Date.parse(file.getDateCreated()) >= Date.parse(_lastRuning)) {
      var status = uploadFile(file);
      if (status == true && isRemoveAfterUpload == true) {
        folder.removeFile(file);
        if (folder.getSize() == 0){
          if (folder.getId() != DriveApp.getFoldersByName(from_upload_folder).next().getId()) {
            if (folder.getParents().hasNext())
              folder.getParents().next().removeFolder(folder);
          }
        }
      } 
    }
  }
 
  var subfolders = folder.getFolders();
  while (subfolders.hasNext())
    uploadFiles(subfolders.next());
}

//Функция выгрузки файла
function uploadFile(file) {
  var userProperties = PropertiesService.getUserProperties();
  var refresh_token = userProperties.getProperty('refresh_token');
  var access_token;
  var response;
  
  //Получаем адрес сервера токенов
  response = UrlFetchApp.fetch('https://dispatcher.cloud.mail.ru/o').toString();
  var token_url = response.substring(0,response.indexOf(' '));
  
  //Авторизуемся и получаем токен или обновляем его если устарел
  if (refresh_token == null) {
    response = JSON.parse(UrlFetchApp.fetch(token_url, {
      payload: {
        client_id: 'cloud-win',
        grant_type: 'password',
        username: username_mailru,
        password: password_mailru
      }
    }));
    userProperties.setProperty('refresh_token', response.refresh_token);
  }
  else {
    response = JSON.parse(UrlFetchApp.fetch(token_url, {
      payload: {
        client_id: 'cloud-win',
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }
    }));
  }
  access_token = response.access_token;
  
  //Получаем адрес сервера загрузки
  response = JSON.parse(UrlFetchApp.fetch('https://cloud.mail.ru/api/v2/dispatcher'));
  var upload_url = response.body.upload[0].url;
  
  
  //Загружаем файл
  response = UrlFetchApp.fetch(upload_url + '?token=' + access_token, {
                                          method: 'put',
                                          headers: {
                                            'Content-Type': file.getMimeType()
                                          },
                                          payload: file.getBlob().getBytes()
  });
  var file_hash = response;
  
  //Публикуем загруженный файл
  response = JSON.parse(UrlFetchApp.fetch('https://cloud.mail.ru/api/v2/tokens?access_token=' + access_token));
  response = JSON.parse(UrlFetchApp.fetch('https://cloud.mail.ru/api/v2/file/add?token=' + response.body.token + '&access_token=' + access_token + '&hash=' + file_hash + '&home=/' + to_upload_folder + '/' +getFolderPath(file) + '/' + file.getName() + '&size=' + file.getSize() + '&conflict=rename'));
  
  if (response.status == 200) return true; else return false;
}

function getFolderPath(file) {
  var folders = [],
      parent = file.getParents();
  
  while (parent.hasNext()) {
    parent = parent.next();
    if (parent.getName() == from_upload_folder) break;
    folders.push(parent.getName());
    parent = parent.getParents();
  }
  
  folders.pop();
  return folders.reverse().join("/");
}

function removeUserProperties() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteAllProperties();
}
