var sql = require('mssql');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var hbs = require('hbs');
var md5 = require('md5');
var cron = require('node-cron');

var fs = '/Users/lucianoscabora/Downloads/Projeto-ugb';


var app = express();

var dbConfig = {
  user: "sa",
  port: 1433,
  autoLoadEntities: true,
  synchronize: true,
  options: { encrypt: false },
  password: "banco($)projeto123",
  server: "localhost",
  database: "sqltix"
};

sql.connect(dbConfig, function (err) {
  if (err) {
    console.log("Erro ao conectar no db :- " + err);
  }
  else {
    console.log("Database conectado");
  }
});

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

hbs.registerHelper('switch', function (value, options) {
  this.switch_value = value;
  return options.fn(this);
});

hbs.registerHelper('case', function (value, options) {
  if (value == this.switch_value) {
    return options.fn(this);
  }
});

app.get('/', function (request, response) {
  response.sendFile(path.join(__dirname, '../PROJETO-UGB', 'login.html'));
});

app.set('views', path.join(__dirname, '../PROJETO-UGB'))
app.set('view engine', 'hbs');
app.use('/assets', express.static(fs + '/public'));


app.post('/auth', function (request, response) {
  var login_usuar = request.body.nome_usuar;
  var senha_usuar = md5(request.body.senha_usuar);
  var solicita = new sql.Request();
  if (login_usuar && senha_usuar) {
    let consulta = "SELECT TOP 1 * FROM usuario WHERE login_usuar = '" + login_usuar + "' AND senha_usuar = '" + senha_usuar + "'";
    solicita.query(consulta, function (error, recordset, fields) {
      if (recordset.rowsAffected > 0) {
        request.session.loggedin = true;
        request.session.nome_usuar = recordset.recordset[0].nome_usuar;
        request.session.id_usuar = recordset.recordset[0].id_usuario;
        request.session.id_ugb = recordset.recordset[0].id_ugb;
        request.session.id_ug = recordset.recordset[0].id_ug;
        request.session.insercao = recordset.recordset[0].insercao;
        request.session.alteracao = recordset.recordset[0].alteracao;
        request.session.exclusao = recordset.recordset[0].exclusao;
        request.session.id_hierarquia = recordset.recordset[0].id_hierarquia;
        response.redirect('/home');
      } else {
        response.send('Credenciais erradas!');
      }
      response.end();
    });
  } else {
    response.send('Por favor entre com suas credenciais!');
    response.end();
  }
});

app.get('/home', function (request, response, results) {
  if (!request.session.loggedin) {
    response.send('Entre para ver a pagina!');
  } else {
    var id_usuar = request.session.id_usuar;
    var erro = request.session.erro;
    request.session.erro = null;
    //console.log(request.session);
    var pendencia = null;

    var solicita = new sql.Request();
    let query = "SELECT id_tarefa, res.nome_usuar AS responsavel, ugb.nome_ugb as ugb,";
    query += "FORMAT(data_pend, 'dd/MM/yyyy') as dtpen,";
    query += "FORMAT(data_prev, 'dd/MM/yyyy') as dtprev,";
    query += "FORMAT(data_fim, 'dd/MM/yyyy') as dtfim,";
    query += "ori.nome_origem as origem, assunto_pend, descr_pend, sta.nome_status AS status_pend,";
    query += "obser_pend, dias_atraso as dtatr, ori.id_tipo as id_tipo  ";
    query += "FROM tarefa AS tar ";
    query += "LEFT JOIN usuario AS usr ON tar.id_usuario = usr.id_usuario ";
    query += "LEFT JOIN (SELECT id_usuario, nome_usuar FROM usuario) RES ON tar.id_responsavel = res.id_usuario ";
    query += "LEFT JOIN origem AS ori ON tar.id_origem = ori.id_origem ";
    query += "LEFT JOIN status AS sta ON tar.status_pend = sta.id_status ";
    query += "LEFT JOIN ugb AS ugb ON tar.id_ugb = ugb.id_ugb ";

    switch (request.session.id_hierarquia) {
      case 1:
        query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '" + request.session.id_hierarquia + "') ";
        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
        break;

      case 2:
        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo IN (1, 2)) ";
        query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "')"
        query += "UNION SELECT id_tarefa, res.nome_usuar AS responsavel, ugb.nome_ugb as ugb,";
        query += "FORMAT(data_pend, 'dd/MM/yyyy') as dtpen,";
        query += "FORMAT(data_prev, 'dd/MM/yyyy') as dtprev,";
        query += "FORMAT(data_fim, 'dd/MM/yyyy') as dtfim,";
        query += "ori.nome_origem as origem, assunto_pend, descr_pend, sta.nome_status AS status_pend,";
        query += "obser_pend, dias_atraso as dtatr, ori.id_tipo as id_tipo  ";
        query += "FROM tarefa AS tar ";
        query += "LEFT JOIN usuario AS usr ON tar.id_usuario = usr.id_usuario ";
        query += "LEFT JOIN (SELECT id_usuario, nome_usuar FROM usuario) RES ON tar.id_responsavel = res.id_usuario ";
        query += "LEFT JOIN origem AS ori ON tar.id_origem = ori.id_origem ";
        query += "LEFT JOIN status AS sta ON tar.status_pend = sta.id_status ";
        query += "LEFT JOIN ugb AS ugb ON tar.id_ugb = ugb.id_ugb WHERE ori.id_tipo = '" + request.session.id_hierarquia + "'";
        //query += "LEFT JOIN ugb AS ugb ON tar.id_ugb = ugb.id_ugb WHERE tar.id_tipo = '2'";
        break;

      case 3:
        query += "WHERE tar.id_ugb in ";
        query += "(SELECT id_ugb FROM ugb WHERE id_ug IN ";
        query += "(SELECT id_ug FROM ug WHERE id_ug = '" + request.session.id_ug + "')) ";
        query += "UNION SELECT id_tarefa, res.nome_usuar AS responsavel, ugb.nome_ugb as ugb,";
        query += "FORMAT(data_pend, 'dd/MM/yyyy') as dtpen,";
        query += "FORMAT(data_prev, 'dd/MM/yyyy') as dtprev,";
        query += "FORMAT(data_fim, 'dd/MM/yyyy') as dtfim,";
        query += "ori.nome_origem as origem, assunto_pend, descr_pend, sta.nome_status AS status_pend,";
        query += "obser_pend, dias_atraso as dtatr, ori.id_tipo as id_tipo  ";
        query += "FROM tarefa AS tar ";
        query += "LEFT JOIN usuario AS usr ON tar.id_usuario = usr.id_usuario ";
        query += "LEFT JOIN (SELECT id_usuario, nome_usuar FROM usuario) RES ON tar.id_responsavel = res.id_usuario ";
        query += "LEFT JOIN origem AS ori ON tar.id_origem = ori.id_origem ";
        query += "LEFT JOIN status AS sta ON tar.status_pend = sta.id_status ";
        query += "LEFT JOIN ugb AS ugb ON tar.id_ugb = ugb.id_ugb WHERE ori.id_tipo = '" + request.session.id_hierarquia + "'";
        break;

      case 4:
        query += "";
    }

    query += "ORDER BY sta.nome_status, FORMAT(data_pend, 'dd/MM/yyyy') DESC";
    //console.log(query);
    solicita.query(query, function (err, results) {
      if (err) {
        console.log("Error while querying database :- " + err);
        throw err;
      }
      else {

        //Carrega pendencias
        pendencia = results.recordset;
        let origens = null;

        switch (request.session.id_hierarquia) {
          case 1:
            query = "SELECT * from origem WHERE id_tipo = '" + request.session.id_hierarquia + "'";
            //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
            break;

          case 2:
            query = "SELECT * from origem WHERE id_tipo IN (1,2) "
            break;

          case 3:
            query = "SELECT * from origem "
            break;

          case 3:
            query = "SELECT * from origem "
            break;

          case 4:
            query = "SELECT * from origem "
            break;
        }

        //query = "SELECT DISTINCT o.id_origem, o.nome_origem, tor.id_tipo, tor.nome_tipo FROM origem AS o LEFT JOIN tiporigem AS tor ON (o.id_tipo = tor.id_tipo) ";
        solicita.query(query, function (err, results) {
          if (err) {
            console.log("Error while querying database :- " + err);
            throw err;
          }
          else {
            //Carrega origens
            origens = results.recordset;
            let status = null
            query = "SELECT * FROM status";
            solicita.query(query, function (err, results) {
              if (err) {
                console.log("Error while querying database :- " + err);
                throw err;
              }
              else {
                //Carrega status
                status = results.recordset;
                let usuarios = null

                switch (request.session.id_hierarquia) {
                  case 1:
                    query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_ugb = " + request.session.id_ugb + ";"
                    //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
                    break;

                  case 2:
                    query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_ugb = " + request.session.id_ugb + ";"
                    //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
                    break;

                  case 3:
                    //query = "SELECT id_usuario, nome_usuar FROM usuario "
                    query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_ug = " + request.session.id_ug + ";"
                    break;

                  case 4:
                    query = "SELECT id_usuario, nome_usuar FROM usuario "
                    //query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_ug = "+request.session.id_ug+";"
                    break;
                }

                //query = "SELECT usuario.id_usuario, usuario.nome_usuar AS usuario FROM usuario LEFT JOIN ugb AS ugb ON ugb.id_ugb = usuario.id_usuario WHERE ugb.id_ugb = "+request.session.id_ugb+";"
                //query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_ugb = "+request.session.id_ugb+";"
                solicita.query(query, function (err, results) {
                  if (err) {
                    console.log("Error while querying database :- " + err);
                    throw err;
                  }
                  else {

                    usuarios = results.recordset;

                    /*
                    let ugbs = null;
                      if (request.session.id_hierarquia = 1) {
                        let query = "SELECT u.nome_ugb FROM usuario as us JOIN ugb as u on us.id_ugb = u.id_ugb WHERE id_usuario = '" + id_usuar + "'";
                        solicita.query(query, function (err, results) {
                          if (err) {
                            console.log("Error while querying database :- " + err);
                            throw err;
                          } 
                          else if (request.session.id_hierarquia = 3) {
                         let query = "SELECT id_ug FROM ug ug WHERE dono_ug = '" + id_usuar + "'";
                         solicita.query(query, function (err, results) {
                          if (err) {
                            console.log("Error while querying database :- " + err);
                            throw err;
                      }
                      else {
                       */


                    let ugbs = null;
                    //let query = "SELECT u.nome_ugb FROM usuario as us JOIN ugb as u on us.id_ugb = u.id_ugb WHERE id_usuario = '" + id_usuar + "'";
                    //query += "(SELECT id_ug FROM ug ug WHERE dono_ug = '" + id_usuar + "')";

                    // let query = "SELECT un.id_ugb, ux.nome_ugb, ux.id_ug FROM usuario AS un JOIN ugb as ux on ux.id_ugb = un.id_ugb WHERE id_usuario = '" + id_usuar + "'";

                    switch (request.session.id_hierarquia) {
                      case 1:
                        query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + request.session.id_ugb + ";"
                        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
                        break;

                      case 2:
                        //query = "SELECT nome_ugb, id_ugb FROM ugb "
                        query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + request.session.id_ugb + ";"
                        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
                        break;

                      case 3:
                        //query = "SELECT id_ugb, nome_ugb FROM ugb "
                        query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
                        query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
                        query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + id_usuar + "'";
                        //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
                        break;

                      case 4:
                        query = "SELECT id_ugb, nome_ugb FROM ugb "
                        break;
                    }
                    //console.log(query);

                    /* let query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
                     query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
                     query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + id_usuar + "'"; */
                    solicita.query(query, function (err, results) {
                      if (err) {
                        console.log("Error while querying database :- " + err);
                        throw err;
                      }
                      else {


                        //Carrega ugbs
                        ugbs = results.recordset;
                        //loga ugbs
                        //console.log(ugbs);
                        //Loga pendencias
                        //console.log('Lista pendencias');
                        //console.log(pendencia);
                        //Loga origens
                        //console.log('Lista origens');
                        //console.log(origem);
                        //Loga status
                        //console.log('Lista status');
                        //console.log(status);
                        //Loga usuarios
                        //console.log('Lista usuarios'_);
                        //console.log(usuarios);
                        response.render('pendencias_view', {
                          pendencias: pendencia,
                          origens: origens, status: status, usuarios: usuarios, erro: erro, ugbs: ugbs,
                          insercao: request.session.insercao,
                          alteracao: request.session.alteracao,
                          exclusao: request.session.exclusao,



                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }
});

// Deletar uma tarefa, consulta a permissão e deleta caso positivo
app.post('/delete', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/home');
    } else {
      var idtar = req.body.id_tarefa;
      query = "DELETE FROM tarefa WHERE id_tarefa=" + idtar;
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/home');
          //console.log(results);
        }
      });
    }
  });
});

//requisição para atualizar uma tarefa, checa permissão e atualiza caso positivo
app.post('/update', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/home');
    } else {
      // array com as variáveis que serão atualizadas no banco carregando os valores do front
      var tarefa = {
        data_pend: req.body.dtpen.trim().length == 0 ? null : req.body.dtpen.trim(),
        id_origem: req.body.origem.trim().length == 0 ? null : req.body.origem.trim(),
        assunto_pend: req.body.assunto_pend.trim().length == 0 ? null : req.body.assunto_pend.trim(),
        descr_pend: req.body.descr_pend.trim().length == 0 ? null : req.body.descr_pend.trim(),
        id_responsavel: req.body.nome_resp.trim().length == 0 ? null : req.body.nome_resp.trim(),
        data_prev: req.body.dtprev.trim().length == 0 ? null : req.body.dtprev.trim(),
        data_fim: req.body.dtfim.trim().length == 0 ? null : req.body.dtfim.trim(),
        status_pend: req.body.status.trim().length == 0 ? 1 : req.body.status.trim(),
        obser_pend: req.body.obser_pend.trim().length == 0 ? null : req.body.obser_pend.trim()
      }
      let first = true;
      let query = "UPDATE tarefa SET ";
      // método para formatar a string de inserção no banco
      Object.keys(tarefa).forEach(function (key) {
        if (tarefa[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(tarefa[key])) {
            query += "'" + tarefa[key] + "'";

          } else {
            query += tarefa[key];
          }
        }
      })
      query += " WHERE id_tarefa=" + req.body.id_tarefa;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/home');
        });
      });
    }
  });
});


app.post('/updateObs', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/home');
    } else {
      var tarefa = {

        obser_pend: req.body.obser_pend.trim().length == 0 ? null : req.body.obser_pend.trim()
      }
      //console.log(tarefa);
      let first = true;
      let query = "UPDATE tarefa SET ";
      //console.log(query);
      Object.keys(tarefa).forEach(function (key) {
        if (tarefa[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(tarefa[key])) {
            query += "'" + tarefa[key] + "'";

          } else {
            query += tarefa[key];
          }
        }
      })
      query += " WHERE id_tarefa=" + req.body.id_tarefa;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/home');
      });
    }
  });
});



// Requisição para inserir uma tarefa no banco, checa permissão e no caso positivo realiza a requisição
app.post('/save', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/home');
    } else {

      //array com variáveis carregando os valores inseridos no front
      var tarefa = {
        id_ugb: req.body.ugb.trim().length == 0 ? null : req.body.ugb.trim(),
        id_ug: req.session.id_ug,
        id_usuario: req.body.nome_resp.trim().length == 0 ? null : req.body.nome_resp.trim(),
        data_pend: req.body.dtpen.trim().length == 0 ? null : req.body.dtpen.trim(),
        id_origem: req.body.origem.trim().length == 0 ? 1 : req.body.origem.trim(),
        assunto_pend: req.body.assunto_pend.trim().length == 0 ? null : req.body.assunto_pend.trim(),
        descr_pend: req.body.descr_pend.trim().length == 0 ? null : req.body.descr_pend.trim(),
        id_responsavel: req.body.nome_resp.trim().length == 0 ? null : req.body.nome_resp.trim(),
        data_prev: req.body.dtprev.trim().length == 0 ? null : req.body.dtprev.trim(),
        data_fim: req.body.dtfim.trim().length == 0 ? null : req.body.dtfim.trim(),
        status_pend: req.body.status.trim().length == 0 ? 1 : req.body.status.trim(),
        inserido_por: req.session.id_usuario,
        obser_pend: req.body.obser_pend.trim().length == 0 ? null : req.body.obser_pend.trim()
      }


      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(tarefa).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (tarefa[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(tarefa[key])) {
            if (valores == null)
              valores = "('" + tarefa[key] + "'";
            else
              valores += ", '" + tarefa[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + tarefa[key];
            else
              valores += ", " + tarefa[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO tarefa " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/home');
        });
      });

    }
  });
});



/* ############################ REGISTRAR ORIGEM VIEW ####################### */

app.get('/cad_origem', (req, res) => {
  var solicita = new sql.Request();
  let origens = null;
  let query = "SELECT o.id_origem, o.nome_origem, tor.id_tipo, tor.nome_tipo "
  query += "FROM origem AS o "
  query += "LEFT JOIN tiporigem AS tor ON (o.id_tipo = tor.id_tipo)"
  //console.log(query);
  //query = "SELECT ori.nome_tipo FROM tiporigem as ori JOIN origem as o on o.id_tipo = ori.id_tipo"
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {
      //Carrega origens
      origens = results.recordset;

      let origini = null;
      let consulta = "SELECT id_tipo, nome_tipo FROM tiporigem"
      solicita.query(consulta, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {

          origini = results.recordset;
          //console.log(origini);


          res.render('cad_origem', { origens: origens, origini: origini })
        }
      });
    }
  });
});

/* ########################## REGISTRO DE ORIGEM AÇÃO ######################## */

app.post('/cad_ori', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_origem');
    } else {

      var origens = {

        nome_origem: req.body.nome_origem.trim().length == 0 ? 1 : req.body.nome_origem.trim(),
        id_tipo: req.body.origem.trim().length == 0 ? 1 : req.body.origem.trim()
      }

      //console.log(origens);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(origens).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (origens[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(origens[key])) {
            if (valores == null)
              valores = "('" + origens[key] + "'";
            else
              valores += ", '" + origens[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + origens[key];
            else
              valores += ", " + origens[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO origem " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_origem');
        });
      });

    }
  });
});

/* ########################### DELETAR ORIGEM #################### */

app.post('/del_ori', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/home');
    } else {
      var idori = req.body.id_origem;
      query = "DELETE FROM origem WHERE id_origem=" + idori;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_origem');
          //console.log(results);
        }
      });
    }
  });
});

/* ########################## EDITAR ORIGEM ##################### */

app.post('/edit_ori', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_origem');
    } else {
      var ori = {

        nome_origem: req.body.nome_origem.trim().length == 0 ? 1 : req.body.nome_origem.trim(),
        id_tipo: req.body.origem.trim().length == 0 ? 1 : req.body.origem.trim()

      }
      //console.log(ori);
      let first = true;
      let query = "UPDATE origem SET ";
      //console.log(query);
      Object.keys(ori).forEach(function (key) {
        if (ori[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(ori[key])) {
            query += "'" + ori[key] + "'";

          } else {
            query += ori[key];
          }
        }
      })
      query += " WHERE id_origem=" + req.body.id_origem;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_origem');
      });
    }
  });
});

/* ############# CADASTRO DE USUÁRIOS COMEÇO ##################### */

app.get('/registrar', (req, res) => {
  var solicita = new sql.Request();
  let usuarios = null;
  let query = "SELECT id_usuario, nome_usuar, login_usuar, insercao, alteracao, exclusao, nome_hierarquia, ugs.nome_ug, nome_ugb "
  query += "FROM usuario AS uzr "
  query += "INNER JOIN ug AS ugs ON (uzr.id_ug = ugs.id_ug) "
  query += "INNER JOIN hierarquia AS hi ON (uzr.id_hierarquia = hi.id_hierarquia) "
  query += "LEFT OUTER JOIN ugb AS ugbs ON (ugbs.id_ugb = uzr.id_ugb) "
  //console.log(query);
  solicita.query(query, (err, results) => {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {
      //Carrega users
      usuarios = results.recordset;

      let hierarquias = null;
      let query = "SELECT id_hierarquia, nome_hierarquia FROM hierarquia "
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {

          hierarquias = results.recordset;
          //console.log(hierarquias);

          let ugbs = null
          let query = "SELECT id_ugb, nome_ugb FROM ugb "

          solicita.query(query, function (err, results) {
            if (err) {
              console.log("Error while querying database :- " + err);
              throw err;
            }
            else {

              //Carrega ugbs
              ugbs = results.recordset;
              //console.log(ugbs);

              let ugs = null
              let query = "SELECT id_ug, nome_ug FROM ug "

              solicita.query(query, function (err, results) {
                if (err) {
                  console.log("Error while querying database :- " + err);
                  throw err;
                }
                else {

                  //Carrega ugbs
                  ugs = results.recordset;

                  let insercao = null;
                  query += "SELECT insercao FROM usuario "
                  solicita.query(query, function (err, results) {
                    if (err) {
                      console.log("Error while querying database :- " + err);
                      throw err;

                    }
                    else {
                      insercao = results.recordset;

                      let alteracao = null;
                      query += "SELECT alteracao FROM usuario "
                      solicita.query(query, function (err, results) {
                        if (err) {
                          console.log("Error while querying database :- " + err);
                          throw err;
                        }
                        else {

                          alteracao = results.recordset;

                          let exclusao = null;
                          query += "SELECT exclusao FROM usuario "
                          solicita.query(query, function (err, results) {
                            if (err) {
                              console.log("Error while querying database :- " + err);
                              throw err;
                            }

                            else {
                              exclusao = results.recordset;


                              res.render('registrar', { usuarios: usuarios, ugbs: ugbs, ugs: ugs, hierarquias: hierarquias, alteracao: alteracao, insercao: insercao, exclusao: exclusao })
                            }
                          });
                        }
                      });

                    }
                  });

                }
              });

            }
          });

        }
      });

    }
  });

});

app.post('/register', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/registrar');
    } else {

      var usuarios = {

        nome_usuar: req.body.nome_usuar.trim().length == 0 ? null : req.body.nome_usuar.trim(),
        login_usuar: req.body.login_usuar.trim().length == 0 ? null : req.body.login_usuar.trim(),
        senha_usuar: req.body.senha_usuar.trim().length == 0 ? 123 : req.body.senha_usuar.trim(),
        id_ugb: req.body.ugb.trim().length == 0 ? null : req.body.ugb.trim(),
        insercao: req.body.insercao.trim().length == 0 ? null : req.body.insercao.trim(),
        alteracao: req.body.alteracao.trim().length == 0 ? null : req.body.alteracao.trim(),
        exclusao: req.body.exclusao.trim().length == 0 ? null : req.body.exclusao.trim(),
        id_hierarquia: req.body.hierarquias.trim().length == 0 ? 0 : req.body.hierarquias.trim(),
        id_ug: req.body.ugs.trim().length == 0 ? 0 : req.body.ugs.trim()

      }


      //console.log(usuarios);

      //console.log(usuarios);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(usuarios).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (usuarios[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(usuarios[key])) {
            if (valores == null)
              valores = "('" + usuarios[key] + "'";
            else
              valores += ", '" + usuarios[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + usuarios[key];
            else
              valores += ", " + usuarios[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO usuario " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        //console.log(query);
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/home');
        });
      });

    }
  });
});


app.post('/del_user', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/home');
    } else {
      var idusr = req.body.id_usuario;
      query = "DELETE FROM usuario WHERE id_usuario=" + idusr;
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/registrar');
          //console.log(results);
        }
      });
    }
  });
});


app.post('/editarcad', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/registrar');
    } else {

      var usuarios = {

        nome_usuar: req.body.nome_usuar.trim().length == 0 ? null : req.body.nome_usuar.trim(),
        login_usuar: req.body.login_usuar.trim().length == 0 ? null : req.body.login_usuar.trim(),
        senha_usuar: req.body.senha_usuar.trim().length == 0 ? 123 : req.body.senha_usuar.trim(),
        id_ugb: req.body.ugb.trim().length == 0 ? null : req.body.ugb.trim(),
        insercao: req.body.insercao.trim().length == 0 ? null : req.body.insercao.trim(),
        alteracao: req.body.alteracao.trim().length == 0 ? null : req.body.alteracao.trim(),
        exclusao: req.body.exclusao.trim().length == 0 ? null : req.body.exclusao.trim(),
        id_hierarquia: req.body.hierarquias.trim().length == 0 ? 0 : req.body.hierarquias.trim(),
        id_ug: req.body.ugs.trim().length == 0 ? 0 : req.body.ugs.trim()

      }


      let first = true;
      var iduser = req.body.id_usuario;
      let query = "UPDATE usuario SET ";
      Object.keys(usuarios).forEach(function (key) {
        if (usuarios[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(usuarios[key])) {
            query += "'" + usuarios[key] + "'";

          } else {
            query += usuarios[key];
          }
        }
      })
      query += " WHERE id_usuario=" + iduser;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/home');
        });
      });
    }
  });
});

/* ############# CADASTRO DE USUÁRIOS FIM ##################### */

/* ############# CADASTRO DE UG COMEÇO ##################### */

app.get('/cad_ug', (req, res) => {
  var solicita = new sql.Request();
  let ugs = null;
  let query = "SELECT ugs.id_ug, nome_ug, dscr_ug, dono_ug, uzr.nome_usuar "
  query += "FROM ug AS ugs "
  query += "INNER JOIN usuario as uzr ON (dono_ug = id_usuario)"

  solicita.query(query, (err, results) => {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {
      //Carrega users
      ugs = results.recordset;

      var solicita = new sql.Request();
      let users = null;
      let query = "SELECT id_usuario, nome_usuar FROM usuario WHERE id_hierarquia = '3' "

      solicita.query(query, (err, results) => {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else
          users = results.recordset;
        {

          res.render('cad_ug', { ugs: ugs, users: users })
        }
      });
    }
  });

});


app.post('/cadastro_ug', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_ug');
    } else {



      var ugs = {

        nome_ug: req.body.nome_ug.trim().length == 0 ? 1 : req.body.nome_ug.trim(),
        dono_ug: req.body.dono_ug.trim().length == 0 ? 1 : req.body.dono_ug.trim(),
        dscr_ug: req.body.dscr_ug.trim().length == 0 ? 1 : req.body.dscr_ug.trim()
      }


      //console.log(ug);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(ugs).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (ugs[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(ugs[key])) {
            if (valores == null)
              valores = "('" + ugs[key] + "'";
            else
              valores += ", '" + ugs[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + ugs[key];
            else
              valores += ", " + ugs[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO ug " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_ug');
        });
      });

    }
  });
});

app.post('/edit_ug', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_ugb');
    } else {
      var ugs = {

        nome_ug: req.body.nome_ug.trim().length == 0 ? 1 : req.body.nome_ug.trim(),
        dono_ug: req.body.dono_ug.trim().length == 0 ? 1 : req.body.dono_ug.trim(),
        dscr_ug: req.body.dscr_ug.trim().length == 0 ? 1 : req.body.dscr_ug.trim()

      }
      let first = true;
      let query = "UPDATE ug SET ";
      //console.log(query);
      Object.keys(ugs).forEach(function (key) {
        if (ugs[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(ugs[key])) {
            query += "'" + ugs[key] + "'";

          } else {
            query += ugs[key];
          }
        }
      })
      query += "WHERE id_ug=" + req.body.id_ug;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_ug');
      });
    }
  });
});

app.post('/del_ug', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_ug');
    } else {

      var idug = req.body.id_ug;
      query = "DELETE FROM ug WHERE id_ug=" + idug;
      console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_ug');
          //console.log(results);
        }
      });
    }
  });
});


/* ############# CADASTRO DE UG FIM ##################### */

/* ############# CADASTRO DE UGB COMEÇO ##################### */
app.get('/cad_ugb', (req, res) => {
  let ugbs = null
  let solicita = new sql.Request();
  let query = "SELECT ugbs.id_ugb, nome_ugb, dscr_ugb, ugs.nome_ug "
  query += "FROM ugb AS ugbs "
  query += "INNER JOIN ug as ugs ON (ugbs.id_ug = ugs.id_ug)"
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {

      //Carrega ugbs
      ugbs = results.recordset;

      let solicita = new sql.Request();
      let query = "SELECT id_ug, nome_ug FROM ug "
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {

          //Carrega ugbs
          ug = results.recordset;

          res.render('cad_ugb', { ugbs: ugbs, ug: ug })
        }
      });
    }
  });
});

app.post('/cadastro_ugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_ug');
    } else {

      var ugbs = {

        nome_ugb: req.body.nome_ugb.trim().length == 0 ? 1 : req.body.nome_ugb.trim(),
        id_ug: req.body.id_ug.trim().length == 0 ? 1 : req.body.id_ug.trim(),
        dscr_ugb: req.body.dscr_ugb.trim().length == 0 ? 1 : req.body.dscr_ugb.trim()
      }

      //console.log(ug);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(ugbs).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (ugbs[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(ugbs[key])) {
            if (valores == null)
              valores = "('" + ugbs[key] + "'";
            else
              valores += ", '" + ugbs[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + ugbs[key];
            else
              valores += ", " + ugbs[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO ugb " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_ugb');
        });
      });

    }
  });
});



app.post('/del_ugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_ugb');
    } else {
      var idugb = req.body.id_ugb;
      query = "DELETE FROM ugb WHERE id_ugb=" + idugb;
      console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_ugb');
          //console.log(results);
        }
      });
    }
  });
});

app.post('/edit_ugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_ugb');
    } else {
      var ugbs = {

        nome_ugb: req.body.nome_ugb.trim().length == 0 ? 1 : req.body.nome_ugb.trim(),
        dscr_ugb: req.body.dscr_ugb.trim().length == 0 ? 1 : req.body.dscr_ugb.trim(),
        id_ug: req.body.id_ug.trim().length == 0 ? 0 : req.body.id_ug.trim()

      }
      let first = true;
      let query = "UPDATE ugb SET ";
      //console.log(query);
      Object.keys(ugbs).forEach(function (key) {
        if (ugbs[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(ugbs[key])) {
            query += "'" + ugbs[key] + "'";

          } else {
            query += ugbs[key];
          }
        }
      })
      query += "WHERE id_ugb=" + req.body.id_ugb;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_ugb');
      });
    }
  });
});


/* ############# CADASTRO DE UGB FIM ##################### */

/* ############# CADASTRO DE HIERARQUIA COMEÇO ##################### */
app.get('/cad_hierarquia', (req, res) => {
  let hierarquias = null
  let solicita = new sql.Request();
  let query = "SELECT id_hierarquia, nome_hierarquia FROM hierarquia "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      hierarquias = results.recordset;

      res.render('cad_hierarquia', { hierarquias: hierarquias })
    }
  });

});
/* ############# CADASTRO DE HIERARQUIA FIM ##################### */


/* ############################## CHECKLIST INICIO ###################### */

app.get('/checklist_view', (req, res) => {
  let checklist = null
  let solicita = new sql.Request();
  let query = "SELECT id_check, nota_item, ponto_forte, falhas, riscos, ";
  query += "FORMAT(data_chk, 'dd/MM/yyyy') as data_chk, ";
  query += "descr_evid as evidencias, u.nome_ug as nome_ug, ";
  query += "descricao, como_auditar, amos_min "
  query += "FROM checklist as chku ";
  query += "LEFT JOIN evidencias as ev ON (chku.id_evid = ev.id_evid) ";
  query += "LEFT JOIN ug as u ON (u.id_ug = chku.id_ug) ";
  query += "LEFT JOIN meios as m ON (m.id_meio = chku.id_meio) ";

  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      //console.log(query);
      throw err;
    }
    else {


      checklist = results.recordset;
      //console.log(checklist);

      let evidencias = null
      let solicita = new sql.Request();
      let query = "SELECT e.descr_evid from evidencias as e LEFT JOIN checklist as ev ON (e.id_evid = ev.id_evid) "
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {


          evidencias = results.recordset;
          //console.log(evidencias);

          let meios = null
          let solicita = new sql.Request();
          let query = "SELECT id_meio, descricao FROM meios "
          //let query = "select m.id_meio, m.descricao, m.como_auditar, m.amos_min from meios as m LEFT JOIN checklist as chkm ON (m.id_meio = chkm.id_meio) "
          solicita.query(query, function (err, results) {

            if (err) {
              console.log("Error while querying database :- " + err);
            }
            else {

              meios = results.recordset;
              //console.log(meios);

              res.render('checklist_view', { evidencias: evidencias, checklist: checklist, meios: meios })
            }
          });
        }
      });
    }
  });
});




/* ########### REGISTRO EVIDÊNCIAS ############# */

app.get('/cadastro_evidencias', (req, res) => {
  let evidencias = null
  let solicita = new sql.Request();
  let query = "SELECT id_evid, descr_evid FROM evidencias "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      evidencias = results.recordset;

      res.render('cadastro_evidencias', { evidencias: evidencias })
    }
  });
});

app.post('/cad_evid', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cadastro_evidencias');
    } else {

      var evidencias = {

        descr_evid: req.body.descr_evid.trim().length == 0 ? 1 : req.body.descr_evid.trim()

      }

      //console.log(origens);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(evidencias).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (evidencias[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(evidencias[key])) {
            if (valores == null)
              valores = "('" + evidencias[key] + "'";
            else
              valores += ", '" + evidencias[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + evidencias[key];
            else
              valores += ", " + evidencias[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO evidencias " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cadastro_evidencias');
        });
      });

    }
  });
});

/* ############## CADASTRO DE MEIOS ###################### */

app.get('/cadastro_meios', (req, res) => {
  let meios = null
  let solicita = new sql.Request();
  let query = "SELECT id_meio, m.id_evid, m.descricao, como_auditar, amos_min, descr_evid FROM meios AS m LEFT JOIN evidencias AS e ON (m.id_evid = e.id_evid)SELECT id_meio, m.id_evid, m.descricao, como_auditar, amos_min, descr_evid, descr_evid FROM meios AS m LEFT JOIN evidencias AS e ON (m.id_evid = e.id_evid) "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {

      meios = results.recordset;

      let evidencias = null
      let solicita = new sql.Request();
      let query = "SELECT id_evid, descr_evid FROM evidencias "
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {
          evidencias = results.recordset;
          //console.log(evidencias);

          res.render('cadastro_meios', { meios: meios, evidencias: evidencias })
        }
      });
    }
  });
});


app.post('/cad_meios', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cadastro_meios');
    } else {

      var meios = {

        descricao: req.body.descricao.trim().length == 0 ? 1 : req.body.descricao.trim(),
        id_evid: req.body.evid.trim().length == 0 ? 1 : req.body.evid.trim(),
        como_auditar: req.body.como_auditar.trim().lenght == 0 ? 1 : req.body.como_auditar.trim(),
        amos_min: req.body.amos_min.trim().length == 0 ? 1 : req.body.amos_min.trim()

      }

      //console.log(origens);
      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(meios).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (meios[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(meios[key])) {
            if (valores == null)
              valores = "('" + meios[key] + "'";
            else
              valores += ", '" + meios[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + meios[key];
            else
              valores += ", " + meios[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO meios " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cadastro_evidencias');
        });
      });

    }
  });
});

//#################### perfil usuários ###########

app.get('/perfil_usuario', (req, res) => {
  let usuarios = null
  let solicita = new sql.Request();
  let query = "SELECT uzr.login_usuar, hi.nome_hierarquia, ugbs.nome_ugb, ugs.nome_ug FROM usuario as uzr "
  query += "INNER JOIN hierarquia AS hi ON (uzr.id_hierarquia = hi.id_hierarquia) "
  query += "INNER JOIN ugb AS ugbs ON (uzr.id_ugb = ugbs.id_ugb) "
  query += "INNER JOIN ug AS ugs ON (uzr.id_ug = ugs.id_ug) "
  query += "WHERE id_usuario=" + req.session.id_usuar;

  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      usuarios = results.recordset;

      res.render('perfil_usuario', { usuarios: usuarios })
    }
  });

});


app.post('/updateSenha', (req, res) => {
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/perfil_usuario');
    } else {

      var password = {

        senha_usuar: req.body.senha.trim().length == 0 ? 1 : req.body.senha.trim()

      }

      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(password).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (password[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(password[key])) {
            if (valores == null)
              valores = "('" + password[key] + "'";
            else
              valores += ", '" + password[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + password[key];
            else
              valores += ", " + password[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO usuario " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/perfil_usuario');
        });
      });

    }
  });
});


// ################### CADASTRO DIMENSÃO ##################################

app.get('/cad_dimensao', (req, res) => {
  let dimensao = null
  let solicita = new sql.Request();
  let query = "SELECT id_dimensao, nome_dimensao FROM dimensao "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      dimensao = results.recordset;

      res.render('cad_dimensao', { dimensao: dimensao })
    }
  });
});

app.post('/cadastro_dim', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_dimensao');
    } else {

      var dimensao = {

        nome_dimensao: req.body.nome_dimensao.trim().length == 0 ? 1 : req.body.nome_dimensao.trim()

      }

      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(dimensao).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (dimensao[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(dimensao[key])) {
            if (valores == null)
              valores = "('" + dimensao[key] + "'";
            else
              valores += ", '" + dimensao[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + dimensao[key];
            else
              valores += ", " + dimensao[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO dimensao " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_dimensao');
        });
      });

    }
  });
});


app.post('/edit_dim', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_dimensao');
    } else {
      var dim = {

        nome_dimensao: req.body.nome_dimensao.trim().length == 0 ? 1 : req.body.nome_dimensao.trim()
      }
      let first = true;
      let query = "UPDATE dimensao SET ";
      //console.log(query);
      Object.keys(dim).forEach(function (key) {
        if (dim[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(dim[key])) {
            query += "'" + dim[key] + "'";

          } else {
            query += dim[key];
          }
        }
      })
      query += " WHERE id_dimensao=" + req.body.id_dimensao;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_dimensao');
      });
    }
  });
});

app.post('/del_dim', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_dimensao');
    } else {
      query = "DELETE FROM dimensao WHERE id_dimensao=" + req.body.id_dimensao;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_dimensao');
          //console.log(results);
        }
      });
    }
  });
});


// ####################### CADASTRO DE DIMENSÃO FIM ##################################




// ####################### CADASTRO INDICADORES COMEÇO #####################################

app.get('/cad_indicador', (req, res) => {
  let indicador = null
  let solicita = new sql.Request();
  let query = "SELECT ind.id_indicador, ind.nome_indicador, ind.metrica_mes, "
  query += "ind.metrica_ano, ind.tipo_indicador, dim.nome_dimensao, ind.ano_indicador FROM indicadores AS ind "
  query += "INNER JOIN dimensao AS dim ON (ind.id_dimensao = dim.id_dimensao) "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      indicador = results.recordset;

      let dimensao = null
      let solicita = new sql.Request();
      let query = "SELECT id_dimensao, nome_dimensao FROM dimensao "
      //console.log(query);
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {
          dimensao = results.recordset;
          //console.log(dimensao);

          res.render('cad_indicador', { indicador: indicador, dimensao: dimensao })
        }
      });
    }
  });
});

app.post('/cadastro_ind', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_indicador');
    } else {

      var indicador = {

        nome_indicador: req.body.nome_indicador.trim().length == 0 ? 1 : req.body.nome_indicador.trim(),
        metrica_mes: req.body.metrica_mes.trim().length == 0 ? 1 : req.body.metrica_mes.trim(),
        metrica_ano: req.body.metrica_ano.trim().length == 0 ? 1 : req.body.metrica_ano.trim(),
        id_dimensao: req.body.id_dimensao.trim().length == 0 ? 1 : req.body.id_dimensao.trim(),
        tipo_indicador: req.body.tipo_indicador.trim().length == 0 ? 0 : req.body.tipo_indicador.trim(),
        ano_indicador: req.body.ano_indicador.trim().length == 0 ? 0 : req.body.ano_indicador.trim()

      }

      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(indicador).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (indicador[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(indicador[key])) {
            if (valores == null)
              valores = "('" + indicador[key] + "'";
            else
              valores += ", '" + indicador[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + indicador[key];
            else
              valores += ", " + indicador[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO indicadores " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_indicador');
        });
      });

    }
  });
});


app.post('/edit_ind', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_indicador');
    } else {
      var indicador = {

        nome_indicador: req.body.nome_indicador.trim().length == 0 ? 1 : req.body.nome_indicador.trim(),
        metrica_mensal: req.body.metrica_mensal.trim().length == 0 ? 1 : req.body.metrica_mensal.trim(),
        metrica_anual: req.body.metrica_anual.trim().length == 0 ? 1 : req.body.metrica_anual.trim(),
        id_dimensao: req.body.id_dimensao.trim().length == 0 ? 1 : req.body.id_dimensao.trim(),
        tipo_indicador: req.body.tipo_indicador.trim().length == 0 ? 0 : req.body.tipo_indicador.trim(),
        ano_indicador: req.body.ano_indicador.trim().length == 0 ? 0 : req.body.ano_indicador.trim()

      }
      let first = true;
      let query = "UPDATE indicadores SET ";
      //console.log(query);
      Object.keys(indicador).forEach(function (key) {
        if (indicador[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(indicador[key])) {
            query += "'" + indicador[key] + "'";

          } else {
            query += indicador[key];
          }
        }
      })
      query += " WHERE id_indicador=" + req.body.id_indicador;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_indicador');
      });
    }
  });
});

app.post('/del_ind', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_indicador');
    } else {
      query = "DELETE FROM indicadores WHERE id_indicador=" + req.body.id_indicador;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_indicador');
          //console.log(results);
        }
      });
    }
  });
});

// ####################### CADASTRO INDICADORES FIM #####################################


// ####################### CADASTRO MOVIMENTO COMEÇO #########################################

app.get('/cad_movimentos', (req, res) => {
  let movimento = null
  let solicita = new sql.Request();
  let query = "SELECT id_movimento, mes, ind.nome_indicador, valor_real, meta_mes, ugb.nome_ugb, ind.ano_indicador "
  query += "FROM movimento as mov INNER JOIN ugb AS ugb ON (ugb.id_ugb = mov.id_ugb) "
  query += "INNER JOIN indicadores as ind ON (ind.id_indicador = mov.id_indicador) WHERE mov.id_ugb = " + req.session.id_ugb + ";"
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      movimento = results.recordset;

      let ugbs = null;
      switch (req.session.id_hierarquia) {
        case 1:
          query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + req.session.id_ugb + ";"
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

        case 2:
          query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + req.session.id_ugb + ";"
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

        case 3:
          query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
          query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
          query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + id_usuar + "'";
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

      }
      //console.log(query);

      /* let query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
       query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
       query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + id_usuar + "'"; */
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {


          //Carrega ugbs
          ugbs = results.recordset;

          let indicadores = null;

          let solicita = new sql.Request();
          let query = "SELECT id_indicador, nome_indicador FROM indicadores "

          solicita.query(query, function (err, results) {
            if (err) {
              console.log("Error while querying database :- " + err);
              throw err;
            }
            else {


              indicadores = results.recordset;

              res.render('cad_movimentos', { movimento: movimento, ugbs: ugbs, indicadores: indicadores })
            }
          });
        }
      });
    }
  });
});
app.post('/cadastro_mov', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_movimentos');
    } else {



      for (var j = 1; j < 12; j++) {

        var movimentos = {

          id_indicador: req.body.id_indicador.trim().length == 0 ? 1 : req.body.id_indicador.trim(),
          mes: req.body.mes.trim().length == null ? null : req.body.mes.trim(),
          valor_real: req.body.valor_real.trim().length == 0 ? 1 : req.body.valor_real.trim(),
          meta_mes: req.body.meta_mes.trim().length == null ? null : req.body.meta_mes.trim(),
          id_ugb: req.body.id_ugb.trim().length == 0 ? null : req.body.id_ugb.trim()

        }

        console.log(movimentos);

        var solicita = new sql.Request();
        var campos = null;
        var valores = null;

        Object.keys(movimentos).forEach(function (key) {
          //console.table('Key : ' + key + ', Value : ' + data[key])
          if (movimentos[key] != null) {
            if (campos == null)
              campos = "(" + key;
            else
              campos += ", " + key;
            if (isNaN(movimentos[key])) {
              if (valores == null)
                valores = "('" + movimentos[key] + "'";
              else
                valores += ", '" + movimentos[key] + "'";
            } else {
              if (valores == null)
                valores = "(" + movimentos[key];
              else
                valores += ", " + movimentos[key];
            }
          }
        })
        campos += ")";
        valores += ")";
        var query = "INSERT INTO movimento " + campos + " VALUES " + valores;
        //Loga insert para debug
        //console.log(query);
        solicita.query(query, (err, results) => {
          if (err)
            throw err;

          solicita.query('EXEC pc_atraso', (err, results) => {
            if (err) throw err;

          });
        });

      }
      res.redirect('/cad_movimentos');
    }
  });
});


app.post('/edit_mov', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_movimentos');
    } else {
      var movimentos = {

        id_indicador: req.body.id_indicador.trim().length == 0 ? 1 : req.body.id_indicador.trim(),
        mes: req.body.mes.trim().length == 0 ? 1 : req.body.mes.trim(),
        valor_real: req.body.valor_real.trim().length == 0 ? 1 : req.body.valor_real.trim(),
        meta_mensal: req.body.meta_mensal.trim().length == 0 ? 1 : req.body.meta_mensal.trim(),
        id_dimensao: req.body.id_dimensao.trim().length == 0 ? 1 : req.body.id_dimensao.trim(),
        id_ugb: req.body.id_ugb.trim().length == 0 ? 1 : req.body.id_ugb.trim()

      }
      let first = true;
      let query = "UPDATE movimentos SET ";
      // console.log(query);
      Object.keys(movimentos).forEach(function (key) {
        if (movimentos[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(movimentos[key])) {
            query += "'" + movimentos[key] + "'";

          } else {
            query += movimentos[key];
          }
        }
      })
      query += " WHERE id_movimento=" + req.body.id_movimento;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_movimentos');
      });
    }
  });
});

app.post('/del_mov', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_movimentos');
    } else {
      query = "DELETE FROM movimento WHERE id_movimento=" + req.body.id_movimento;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_movimentos');
          //console.log(results);
        }
      });
    }
  });
});


// ######### CAD INDUGB COMEÇO ###########


app.get('/cad_indugb', (req, res) => {
  let indicadorugb = null
  let solicita = new sql.Request();
  let query = "SELECT id_indugb, ind.nome_indicador, ugb.nome_ugb, ug.nome_ug, meta_ano FROM ind_ugb AS indu "
  query += "INNER JOIN indicadores AS ind ON (ind.id_indicador = indu.id_indicador) "
  query += "INNER JOIN ugb AS ugb ON (ugb.id_ugb = indu.id_ugb) "
  query += "INNER JOIN ug AS ug ON (ug.id_ug = indu.id_ug) "
  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {


      indicadorugb = results.recordset;

      let ugbs = null;
      //let query = "SELECT u.nome_ugb FROM usuario as us JOIN ugb as u on us.id_ugb = u.id_ugb WHERE id_usuario = '" + id_usuar + "'";
      //query += "(SELECT id_ug FROM ug ug WHERE dono_ug = '" + id_usuar + "')";

      // let query = "SELECT un.id_ugb, ux.nome_ugb, ux.id_ug FROM usuario AS un JOIN ugb as ux on ux.id_ugb = un.id_ugb WHERE id_usuario = '" + id_usuar + "'";

      switch (req.session.id_hierarquia) {
        case 1:
          query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + req.session.id_ugb + ";"
          //console.log(query);
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

        case 2:
          query = "SELECT nome_ugb, id_ugb FROM ugb WHERE id_ugb = " + req.session.id_ugb + ";"
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

        case 3:
          query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
          query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
          query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + req.session.id_usuar + "'";
          //query += "WHERE tar.id_ugb = (SELECT id_ugb FROM usuario WHERE id_usuario = '" + id_usuar + "' AND ori.id_tipo = '"+request.session.id_hierarquia+"') "
          break;

      }
      //console.log(query);

      /* let query = "SELECT ugbs.id_ugb, ugbs.nome_ugb FROM ugb AS ugbs "
       query += "INNER JOIN ug AS ugs ON (ugbs.id_ug = ugs.id_ug) "
       query += "INNER JOIN usuario as uzr ON (ugbs.id_ug = uzr.id_ug) WHERE id_usuario = '" + id_usuar + "'"; */
      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {


          //Carrega ugbs
          ugbs = results.recordset;

          let indicadores = null;

          let solicita = new sql.Request();
          let query = "SELECT id_indicador, nome_indicador FROM indicadores "

          solicita.query(query, function (err, results) {
            if (err) {
              console.log("Error while querying database :- " + err);
              throw err;
            }
            else {


              indicadores = results.recordset;

              let ugs = null
              let query = "SELECT id_ug, nome_ug FROM ug WHERE id_ug = " + req.session.id_ug + ";"
              //console.log(query);

              solicita.query(query, function (err, results) {
                if (err) {
                  console.log("Error while querying database :- " + err);
                  throw err;
                }
                else {

                  //Carrega ugbs
                  ugs = results.recordset;

                  res.render('cad_indugb', { indicadorugb: indicadorugb, ugbs: ugbs, indicadores: indicadores, ugs: ugs })
                }
              });
            }
          });
        }
      });
    }
  });
});


app.post('/cadastro_indugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/cad_indugb');
    } else {

      var indicadorugb = {

        id_ugb: req.body.id_ugb.trim().length == 0 ? null : req.body.id_ugb.trim(),
        id_ug: req.body.id_ug.trim().length == 0 ? null : req.body.id_ug.trim(),
        id_indicador: req.body.id_indicador.trim().length == 0 ? null : req.body.id_indicador.trim(),
        meta_ano: req.body.meta_ano.trim().length == 0 ? 1 : req.body.meta_ano.trim()

      }

      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(indicadorugb).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (indicadorugb[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(indicadorugb[key])) {
            if (valores == null)
              valores = "('" + indicadorugb[key] + "'";
            else
              valores += ", '" + indicadorugb[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + indicadorugb[key];
            else
              valores += ", " + indicadorugb[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO ind_ugb " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/cad_indugb');
        });
      });

    }
  });
});


app.post('/edit_indugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/cad_indugb');
    } else {
      var indicadorugb = {

        id_ugb: req.body.id_ugb.trim().length == 0 ? 1 : req.body.id_ugb.trim(),
        id_ug: req.body.id_ug.trim().length == 0 ? 1 : req.body.id_ug.trim(),
        meta_ano: req.body.meta_ano.trim().length == 0 ? 1 : req.body.meta_ano.trim()

      }
      let first = true;
      let query = "UPDATE ind_ugb SET ";
      //console.log(query);
      Object.keys(indicadorugb).forEach(function (key) {
        if (indicadorugb[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(indicadorugb[key])) {
            query += "'" + indicadorugb[key] + "'";

          } else {
            query += indicadorugb[key];
          }
        }
      })
      query += " WHERE id_indugb=" + req.body.id_indugb;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/cad_indugb');
      });
    }
  });
});

app.post('/del_indugb', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT exclusao FROM usuario WHERE exclusao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissão para deletar");
      req.session.erro = 'Usuário sem permissão para deletar';
      res.redirect('/cad_indugb');
    } else {
      query = "DELETE FROM ind_ugb WHERE id_indugb=" + req.body.id_indugb;
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) {
          console.log(err);
        }
        else {
          res.redirect('/cad_indugb');
          //console.log(results);
        }
      });
    }
  });
});


app.get('/farol_view', (req, res) => {
  var solicita = new sql.Request();
  let farol = null;
  let query = "SELECT id_farol, nome_dimensao, far.id_indicador, mov.meta_mes, ind.nome_indicador, "
  query += "mov.mes, ind.ano_indicador, tipo_indicador, far.valor_real FROM farol AS far "
  query += "INNER JOIN dimensao AS dim ON (far.id_dimensao = dim.id_dimensao) "
  query += "INNER JOIN indicadores AS ind ON (far.id_indicador = ind.id_indicador) "
  query += "INNER JOIN movimento AS mov ON (far.id_movimento = mov.id_movimento) "
  //console.log(query);

  solicita.query(query, function (err, results) {
    if (err) {
      console.log("Error while querying database :- " + err);
      throw err;
    }
    else {

      farol = results.recordset;


      let dimensao = null;
      let query = "SELECT id_dimensao, nome_dimensao FROM dimensao "

      solicita.query(query, function (err, results) {
        if (err) {
          console.log("Error while querying database :- " + err);
          throw err;
        }
        else {

          dimensao = results.recordset;

          let indicadores = null;
          let query = "SELECT id_indicador, nome_indicador FROM indicadores "

          solicita.query(query, function (err, results) {
            if (err) {
              console.log("Error while querying database :- " + err);
              throw err;
            }
            else {

              indicadores = results.recordset;


              let movimentos = null;
              let query = "SELECT id_movimento FROM movimento "

              solicita.query(query, function (err, results) {
                if (err) {
                  console.log("Error while querying database :- " + err);
                  throw err;
                }
                else {

                  movimentos = results.recordset;


                  res.render('farol_view', { farol: farol, dimensao: dimensao, indicadores: indicadores, movimentos: movimentos })
                }
              });
            }
          });
        }
      });
    }
  });
});


app.post('/updValor', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT alteracao FROM usuario WHERE alteracao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para alterar");
      req.session.erro = 'Usuario sem permissao para alterar';
      res.redirect('/farol_view');
    } else {
      var farol = {

        valor_real: req.body.valor_real.trim().length == 0 ? null : req.body.valor_real.trim()
      }
      let first = true;
      let query = "UPDATE farol SET ";
      //console.log(query);
      Object.keys(farol).forEach(function (key) {
        if (farol[key] != null) {
          if (first) {
            query += key + "=";
            first = false;
          } else {
            query += ", " + key + "=";
          }
          if (isNaN(farol[key])) {
            query += "'" + farol[key] + "'";

          } else {
            query += farol[key];
          }
        }
      })
      query += " WHERE id_farol=" + req.body.id_farol;
      console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        res.redirect('/farol_view');
      });
    }
  });
});

app.post('/cadastro_farol', (req, res) => {
  var solicita = new sql.Request();
  let query = "SELECT insercao FROM usuario WHERE insercao=1 AND "
  query += "id_usuario=" + req.session.id_usuar;
  solicita.query(query, (err, results) => {
    if (results.rowsAffected < 1) {
      console.log("Sem permissao para incluir");
      req.session.erro = 'Usuario sem permissao para incluir';
      res.redirect('/farol_view');
    } else {

      //array com variáveis carregando os valores inseridos no front
      var farol = {
        id_indicador: req.body.id_indicador.trim().length == 0 ? null : req.body.id_indicador.trim(),
        id_dimensao: req.body.id_dimensao.trim().length == 0 ? null : req.body.id_dimensao.trim(),
        id_movimento: req.body.id_movimento.trim().length == 0 ? null : req.body.id_movimento.trim()

      }


      var solicita = new sql.Request();
      var campos = null;
      var valores = null;

      Object.keys(farol).forEach(function (key) {
        //console.table('Key : ' + key + ', Value : ' + data[key])
        if (farol[key] != null) {
          if (campos == null)
            campos = "(" + key;
          else
            campos += ", " + key;
          if (isNaN(farol[key])) {
            if (valores == null)
              valores = "('" + farol[key] + "'";
            else
              valores += ", '" + farol[key] + "'";
          } else {
            if (valores == null)
              valores = "(" + farol[key];
            else
              valores += ", " + farol[key];
          }
        }
      })
      campos += ")";
      valores += ")";
      var query = "INSERT INTO farol " + campos + " VALUES " + valores;
      //Loga insert para debug
      //console.log(query);
      solicita.query(query, (err, results) => {
        if (err) throw err;
        solicita.query('EXEC pc_atraso', (err, results) => {
          if (err) throw err;
          res.redirect('/farol_view');
        });
      });

    }
  });
});

cron.schedule('*/10 * * * *', () => {
  var solicita = new sql.Request();
  solicita.query('EXEC pc_atraso', (err, results) => {
    if (err) throw err;
    console.log('Tarefa pc_atraso executada...');
  });
});

const server = app.listen('3000', 'localhost', () => {
  console.log('Server is running..');

});
