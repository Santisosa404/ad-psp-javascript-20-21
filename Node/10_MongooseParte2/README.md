# 10 Mongoose (2ª Parte)

## 1. Modelos de datos más complejos

En el ejemplo anterior hemos trabajado con un modelo de datos tan simple que solamente incluía un modelo (es decir, una sola colección en la base de datos). Esto dista mucho de reflejar la realidad, donde las aplicaciones suelen incluir modelos de datos más o menos complejos (cosa que ya hemos trabajado desde el año pasado en Bases de Datos, y este año en el módulo de Acceso a Datos).

Mongoose es lo suficientemente potente para poder representar casi cualquier esquema que necesitemos, tanto si lo queremos representar con una estructura embebida, referencial o híbrida (recordar el documento: [https://docs.microsoft.com/es-es/azure/cosmos-db/modeling-data](https://docs.microsoft.com/es-es/azure/cosmos-db/modeling-data)).

## 2. Subdocumentos

Los subdocumentos son documentos incrustados dentro de otros documentos. En Mongoose, esto significa que se pueden anidar esquemas en otros esquemas. Podemos encontrarlos tanto de forma aislada como en arrays.

```javascript
const childSchema = new Schema({ name: 'string' });

const parentSchema = new Schema({
  // Array de subdocumentos
  children: [childSchema],
  // Subdocumento anidado. Ten en cuenta que esto (sin array) sólo
  // funciona en mongoose >= 4.2.0
  child: childSchema
});
```

También podemos definir el esquema incrustado _al vuelo_:

```javascript
const groupSchema = Schema({
  name: String,
  members: [{ firstName: String, lastName: String }]
});
```

Los esquemas para subdocumentos anidados son esquemas como otros cualesquiera, y por tanto, pueden tener las mismas características (middlewares, lógica de validación, métodos propios, ...). La gran diferencia es que no se salvan de forma individual, sino que forman parte de otro documento _de nivel superior_.

```javascript
const Parent = mongoose.model('Parent', parentSchema);
const parent = new Parent({ children: [{ name: 'Matt' }, { name: 'Sarah' }] })
parent.children[0].name = 'Matthew';

// `parent.children[0].save()` no salva el documento
// Tienes que salvar el documento `parent` para almacenar en la base de datos
parent.save(callback);
```

Cada subdocumento tiene su propio `_id` por defecto. En Mongoose, los arrays de documentos tienen un método especial, llamado `id(val)` para buscar documentos dentro del array con un id que se pasar como valor.

```javascript
const doc = parent.children.id(_id);
```

### 2.1 Añadir subdocumentos a un array

Los arrays con los que trabajamos en Mongoose son de un tipo especial, MongooseArray. Esta clase extiende a los arrays de Javascript, añadiendo funcionalidades propias de Mongoose.

Este tipo incluye métodos ya conocidos, como `push`, `unshift` o `addToSet`.

```javascript
const Parent = mongoose.model('Parent');
const parent = new Parent;

// Añadimos un documento al array
parent.children.push({ name: 'Liesl' });
const subdoc = parent.children[0];
console.log(subdoc) // { _id: '501d86090d371bab2c0341c5', name: 'Liesl' }
subdoc.isNew; // true

parent.save(function (err) {
  if (err) return handleError(err)
  console.log('Success!');
});
```

Los subdocumentos también se pueden crear sin añadirlos directamente al array a través del método `create` de `MongooseArray`.

```javascript
const newdoc = parent.children.create({ name: 'Aaron' });
```

### 2.2 Eliminar subdocumentos

Cada subdocumento tiene su propio método `remove`. Para un subdocumento en un array, es equivalente a hacer un `pull`.

```javascript
// Equivalente a `parent.children.pull(_id)`
parent.children.id(_id).remove();
// Equivalente a `parent.child = null`
parent.child.remove();
parent.save(function (err) {
  if (err) return handleError(err);
  console.log('the subdocs were removed');
});
```

### 2.3 Uso de `parent`

En ocasiones, puede interesarte acceder al _padre_ de un subdocumento. Esto puede hacerse con la función `parent`.

```javascript
const schema = new Schema({
  docArr: [{ name: String }],
  singleNested: new Schema({ name: String })
});
const Model = mongoose.model('Test', schema);

const doc = new Model({
  docArr: [{ name: 'foo' }],
  singleNested: { name: 'bar' }
});

doc.singleNested.parent() === doc; // true
doc.docArr[0].parent() === doc; // true
```

## 3. Referencias entre documentos

Mongoose permite definir un esquema con un campo que hace referencia a otro esquema. Es algo parecido a las claves externas en las bases de datos relacionales.

A continuación, podemos ver un ejemplo de cómo se realiza:

```javascript
const Person = mongoose.model('Person', mongoose.Schema({
  name: String
}));

// `ref` tells Mongoose populate what model to query
const Movie = mongoose.model('Movie', mongoose.Schema({
  title: String,
  director: {
    type: mongoose.ObjectId,
    ref: 'Person'
  },
  actors: [{
    type: mongoose.ObjectId,
    ref: 'Person'
  }]
}));
```

En este ejemplo, hemos definido dos modelos. El modelo `Person`, que está formado solamente por una cadena de caracteres. Y el modelo `Movie`, que tiene un `title`, así como dos referencias al modelo `Person`.

Para indicar que un campo de un esquema es una referencia a otro modelo debemos:

-  Establecer el `type` con valor `mongoose.ObjectId` o `Schema.Types.ObjectId`.
-  Añadir la propiedad `ref`, indicando el nombre del modelo al que hacemos referencia

> El valor de `ref` es el nombre que establecemos al crear un modelo a partir del esquema. En el ejemplo, este valor es `Person` porque creamos el modelo con `mongoose.model('Person', ...)`.

A continuación podemos ver un ejemplo (es didáctico, no sería muy operativo en la práctica) de como crear una serie de personas y películas, así como las referencias entre estos.

```javascript
const people = await Person.create([
  { name: 'James Cameron' },
  { name: 'Arnold Schwarzenegger' },
  { name: 'Linda Hamilton' }
]);
await Movie.create({
  title: 'Terminator 2',
  director: people[0]._id,
  actors: [people[1]._id, people[2]._id]
});
```

### 3.1 Función `populate`

Mongoose dispone de la función `populate`, que permite extraer documentos referenciados en otra colección. Es similar a un _LEFT OUTER JOIN_ en SQL, con la salvedad de que `populate` no se ejecuta en MongoDB, sino en Node.js. Mongoose ejecuta las consultas por separado para cargar los documentos referenciados.

```javascript
// Load just the movie's director
let movie = await Movie.findOne().populate('director');
movie.director.name; // 'James Cameron'
movie.actors[0].name; // undefined

// Load both the director and the actors
movie = await Movie.findOne().populate('director').populate('actors');
movie.director.name; // 'James Cameron'
movie.actors[0].name; // 'Arnold Schwarzenegger'
movie.actors[1].name; // 'Linda Hamilton'
```

Los documentos de Mongoose también disponen de la función, por lo que si ya tenemos el documento cargado, podemos ejecutarla:

```javascript
// Load just the movie's director
let movie = await Movie.findOne();
movie.director.name; // undefined
movie.actors[0].name; // undefined

// Populate the director
await movie.populate('director').execPopulate();
movie.director.name; // 'James Cameron'
movie.actors[0].name; // undefined

// Populate the actors
await movie.populate('actors').execPopulate();
movie.director.name; // 'James Cameron'
movie.actors[0].name; // 'Arnold Schwarzenegger'
movie.actors[1].name; // 'Linda Hamilton'
```

Si estamos _rellenando_ con `populate` un solo documento, y el documento al que hacemos referencia no existe, la propiedad se establece a `null`.

```javascript
await Person.deleteOne({ name: 'James Cameron' });

const movie = await Movie.findOne().populate('director');
movie.director; // null
```

Si estamos rellenando con `populate` un array de documentos y uno de los identificadores no existe, Mongoose filtrará dicho resultado, devolviendo un array más pequeño. Este comportamiento por defecto se puede modificar con la opción `retainNullValues`.

```javascript
await Person.deleteOne({ name: 'Arnold Schwarzenegger' });

let movie = await Movie.findOne().populate('actors');
movie.actors.length; // 1
movie.actors[0].name; // 'Linda Hamilton'

// Set `retainNullValues` option to insert `null` for
// missing documents in the array
movie = await Movie.findOne().populate({
  path: 'actors',
  options: { retainNullValues: true }
});
movie.actors.length; // 2
movie.actors[0]; // null
movie.actors[1].name; // 'Linda Hamilton'
```

### 3.2 `populate` con consultas

Una de las formas más habituales de usar `populate` es a la vez que realizamos una consulta.

Supongamos el siguiente modelo de datos:

```javascript
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const personSchema = Schema({
  _id: Schema.Types.ObjectId,
  name: String,
  age: Number,
  stories: [{ type: Schema.Types.ObjectId, ref: 'Story' }]
});

const storySchema = Schema({
  author: { type: Schema.Types.ObjectId, ref: 'Person' },
  title: String,
  fans: [{ type: Schema.Types.ObjectId, ref: 'Person' }]
});

const Story = mongoose.model('Story', storySchema);
const Person = mongoose.model('Person', personSchema);

const author = new Person({
  _id: new mongoose.Types.ObjectId(),
  name: 'Ian Fleming',
  age: 50
});

author.save(function (err) {
  if (err) return handleError(err);

  const story1 = new Story({
    title: 'Casino Royale',
    author: author._id    // assign the _id from the person
  });

  story1.save(function (err) {
    if (err) return handleError(err);
    // that's it!
  });
});
```

Nos puede interesar buscar una determinada instancia de `Story` en la que, a la vez, _rellenemos_ el autor. 

```javascript
const story = await Story
                .findOne({ title: 'Casino Royale' })
                .populate('author').
                .exec();
```

Las propiedades que hemos definido en el esquema como `ref` no mostrarán un valor de `_id`, sino el correspondiente documento que se ha obtenido de la base de datos a partir de una consulta separada. Los arrays de `ref` funcionan de igual forma; si invocamos a `populate` obtendremos un array de documentos.

#### 3.2.1 Selección de campos

Si solamente queremos obtener unos pocos campos del documento referenciado (lo que se conoce como proyección) podemos utilizar la [sintaxis de nombre de campo](https://mongoosejs.com/docs/api.html#query_Query-select) como segundo argumento del método `populate`.

```javascript
const story = await Story.
                .findOne({ title: /casino royale/i })
                .populate('author', 'name') // solamente devuelve el nombre del autor
                .exec();
```

#### 3.2.2 `populate` de varios campos

Si queremos, podemos realizar el `populate` de varios campos a la vez:

```javascript
Story.
  find(...).
  populate('fans').
  populate('author').
  exec();
```

Si invocamos `populate` para un campo más de una vez, solamente tendrá efecto la última llamada que realicemos:

```javascript
// El segundo populate sobrescribe al primero
Story.
  find().
  populate({ path: 'fans', select: 'name' }).
  populate({ path: 'fans', select: 'email' });
// El código de arriba sería equivalente a:
Story.find().populate({ path: 'fans', select: 'email' });
```

#### 3.2.3 `populate` con condiciones

¿Y si queremos rellenar nuestro array `fans` basándonos en una condición y rescatando solamente el campo `name`?

```javascript
Story.
  find().
  populate({
    path: 'fans',
    match: { age: { $gte: 21 } },
    // Explicitly exclude `_id`, see http://bit.ly/2aEfTdB
    select: 'name -_id'
  }).
  exec();
```

La opción `match` **no realiza un filtrado sobre los documentos de tipo `Story`**. Y no hay documentos que satisfagan la condición impuesta en `match`, obtendremos una instancia de `Story` con un array `fans` vacío.

### 3.3 `populate` en varios niveles

Supongamos que tenemos un esquema que nos permite manejar los amigos de un `User`.

```javascript
const userSchema = new Schema({
  name: String,
  friends: [{ type: ObjectId, ref: 'User' }]
});
```

La función `populate` nos permite obtener una lista de los amigos de un usuario. Pero, ¿y si queremos obtener los amigos de los amigos? Se puede especificar, para un `populate`, que queremos hacer otro:

```javascript
User.
  findOne({ name: 'Val' }).
  populate({
    path: 'friends',
    // Get friends of friends - populate the 'friends' array for every friend
    populate: { path: 'friends' }
  });
```

> Pregúntate: ¿cómo sería el JSON de resultado?

# 4. ¡Vamos al código!

Vamos a implementar un _sencillo_ ejemplo que trabaje con dos modelos: `Pelicula` y `Persona`. Para ello, debemos realizar los pasos iniciales que vimos en tutoriales anteriores.

> Cabe destacar que para no hacer más complejo el ejemplo, no incluye ni seguridad ni validación.

## 4.1 Modelos

Creamos dos ficheros dentro de la carpeta `src/models`: `pelicula.js` y `persona.js`.

`src/models/persona.js`:

```javascript
import mongoose from 'mongoose';
const { Schema } = mongoose;

const personaSchema = new Schema({
    nombre: String,
    urlFoto: String
});

const Persona = mongoose.model('Persona', personaSchema);

```

En primer lugar realizamos las importaciones oportunas y definimos el esquema. Este será simple, y estará formado solamente por dos cadenas de caracteres: el `nombre` y la `urlFoto` de la persona. Estas personas, como veremos más adelante, podrán representar a los directores y a los actores de las películas.


Más adelante, en el mismo fichero, definimos el repositorio:

> En la literatura sobre Mongoose, es más habitual encontrar que los programadores unifican en un método el controlador y la operación sobre los datos en un solo método, haciendo uso de promesas y los métodos `then` y `catch`. En nuestro caso haremos uso de `async/await` que nos permite definir un objeto repositorio, con métodos que reciben argumentos y producen valores resultado.

```javascript
const PersonaRepository = {

    async findAll() {
        return await Persona.find().exec();
    },

    async findById(id) {
        const result = await Persona.findById(id).exec();
        return result != null ? result : undefined;
    },

    async create(nuevaPersona) {
        const persona = new Persona({
            nombre: nuevaPersona.nombre,
            urlFoto: nuevaPersona.urlFoto
        });
        const result = await persona.save();
        return result;
    },

    async updateById(id, personaModificada) {
        const persona = await Persona.findById(id);

        if (persona == null) {
            return undefined;
        } else {
            return await Object.assign(persona, personaModificada).save();
        }
    },

    async update(personaModificada) {
        return await this.updateById(personaModificada.id, personaModificada);
    },

    async delete(id) {
        await Persona.findByIdAndRemove(id).exec();
    }

}
```

- El método `findAll()` tan solo necesita invocar al método `find` del modelo sin argumentos.
- Algo parecido sucede con el método `findById()`, que invoca al mismo método del modelo.
- Los métodos `create`, `updateById`, `update` y `delete` es similar al ejemplo anterior.


> Por último, destacar que se ha añadido al repositorio una nueva versión de la colección de peticiones de postman, que incluye peticiones de ejemplo para esta API.

En el caso del modelo de `Pelicula`, el código es el siguiente:

`src/models/pelicula.js`

```javascript
import mongoose from 'mongoose';
const {
    Schema
} = mongoose;

const peliculaSchema = new Schema({
    titulo: String,
    portadaURL: String,
    director: {
        type: mongoose.ObjectId,
        ref: 'Persona'
    },
    actores: [{
        type: mongoose.ObjectId,
        ref: 'Persona'
    }]
});

const Pelicula = mongoose.model('Pelicula', peliculaSchema);

```

Definimos el esquema de `Pelicula`, donde las propiedades más complejas son `director` y `actores`:

- `director` hace referencia al modelo de `Persona`. Esto se consigue indicando que el `type` es `mongoose.ObjectId` y el atributo `ref`, como cadena de caracteres, a `'Persona'`.
- `actores` sería un array de referencias, también al modelo de `Persona`. Esto se consigue añadiendo los corchetes, y por tanto, indicando que es un array.

Dentro del repositorio es donde vamos a utilizar la función `populate` para unificar los modelos de `Pelicula` y `Persona`:

```javascript
const PeliculaRepository = {

    async findAll() {
        return await Pelicula
            .find()
            .populate('director', 'nombre')
            .populate('actores', 'nombre')
            .exec();
    },

    async findById(id) {
        return await Pelicula
            .findById(id)
            .populate('director')
            .populate('actores')
            .exec();
    },

    // por simplicidad, creamos una película sin actores
    async create(nuevaPelicula) {
        const pelicula = new Pelicula({
            titulo: nuevaPelicula.titulo,
            director: nuevaPelicula.director,
            portadaURL: nuevaPelicula.portadaURL
        });

        const result = await pelicula.save();
        return result;
    },

    async updateById(id, peliculaModificada) {
        const pelicula = await Pelicula.findById(id);

        if (pelicula == null) {
            return undefined;
        } else {
            return await Object.assign(pelicula, peliculaModificada).save();
        }
    },

    async update(peliculaModificada) {
        return await this.updateById(peliculaModificada.id, peliculaModificada);
    },

    async delete(id) {
        await Pelicula.findByIdAndRemove(id).exec();
    }
}
```

Destacan aquí los métodos de búsqueda:

- En el caso del método `findAll()`, invocamos a `populate` para cada propiedad referenciada. Además, en lugar de devolver el objeto completo, se hace una _selección_ mostrando solamente el nombre.
- En el caso del método `findById()`, invocamos también `populate`, pero en este caso, devolviendo los objetos completos.

> Cabría preguntarse ahora, ¿es necesario hacer un populate a la hora de devolver los resultados de `create` y `update`?

##  4.2 Controladores

El controlador de `Persona` se parece mucho al controlador del ejemplo anterior:

```javascript
import { PersonaRepository } from '../models/persona';

const PersonaController = {

    todasLasPersonas: async (req, res) => {
        const data = await PersonaRepository.findAll();
        if (Array.isArray(data) && data.length > 0) 
            res.json(data);
        else
            res.sendStatus(404);
    },

    personaPorId: async (req, res) => {
        let persona = await PersonaRepository.findById(req.params.id);
        if (persona != undefined)
            res.json(persona);
        else
            res.sendStatus(404);
    },

    nuevaPersona: async (req, res) => {
        let persona = await PersonaRepository.create({
            nombre: req.body.nombre,
            urlFoto: req.body.urlFoto
        });
        res.status(201).json(persona);
    },

    editarPersona: async (req, res) => {
        let persona = await PersonaRepository
                        .updateById(req.params.id, {
                            nombre: req.body.nombre,
                            urlFoto: req.body.urlFoto
                        });
        if (persona != undefined) {
            res.json(persona);
        } else {
            res.sendStatus(404);
        }
    },

    eliminarPersona: async (req, res) => {
        await PersonaRepository.delete(req.params.id);
        res.sendStatus(204);
    }


}

export {
    PersonaController
}
```

Los cambios suceden más en el controlador de `Pelicula`. El esqueleto del código sería el siguiente:

```javascript
import {
    PeliculaRepository
} from '../models/pelicula';
import {
    PersonaRepository
} from '../models/persona';

const PeliculaController = {

}
```

A partir de ahí, tendríamos los siguiente métodos, similar a los ejemplos anteriores:

```javascript
    todasLasPeliculas: async (req, res) => {
        const data = await PeliculaRepository.findAll();
        if (Array.isArray(data) && data.length > 0)
            res.json(data);
        else
            res.sendStatus(404);
    },

    peliculaPorId: async (req, res) => {
        let pelicula = await PeliculaRepository.findById(req.params.id);
        if (pelicula != undefined)
            res.json(pelicula);
        else
            res.sendStatus(404);
    },

    nuevaPelicula: async (req, res) => {
        let pelicula = await PeliculaRepository.create({
            titulo: req.body.titulo,
            portadaURL: req.body.portadaURL,
            director: req.body.director
        });
        res.status(201).json(pelicula);
    },

    editarPelicula: async (req, res) => {
        let pelicula = await PeliculaRepository
            .updateById(req.params.id, {
                titulo: req.body.titulo,
                portadaURL: req.body.portadaURL,
                director: req.body.director
            });
        if (pelicula != undefined) {
            res.json(pelicula);
        } else {
            res.sendStatus(404);
        }
    },

    eliminarPelicula: async (req, res) => {
        await PeliculaRepository.delete(req.params.id);
        res.sendStatus(204);
    },
```

Estos métodos son sencillos, y similares a los métodos del ejemplo anterior. Se añadirían dos nuevos métodos, que realizarán las siguientes acciones:

-  Añadir un actor a una película
-  Eliminar un actor de una película

Los métodos serían los siguientes:

```javascript
    addActorPelicula: async (req, res) => {

        let actor = await PersonaRepository.findById(req.params.id_actor);
        if (actor != undefined) {
            let pelicula = await PeliculaRepository.findById(req.params.id_pelicula);
            if (pelicula != undefined) {
                pelicula.actores.push(actor._id);
                await pelicula.save();
                // Volvemos a rescatar la película para aplicar los diferentes `populate`
                // Seguramente este código se podría refactorizar y mejorar
                res.json(await PeliculaRepository.findById(pelicula._id));
            } else {
                res.status(400).json({
                    mensaje: `La película con ID: ${req.params.id_pelicula} no está registrada en la base de datos`
                });
            }
        } else {
            // Este manejo de error podría unificarse
            // para una mejor gestión a través de un 
            // middleware común
            res.status(400).json({
                mensaje: `El actor con ID: ${req.params.id_actor} no está registrado en la base de datos`
            });
        }

    }
```

En este caso, la operativa del método sería la siguiente:

- Buscamos la persona (actor) que queremos añadir por su `id`.
- Si el actor existe, buscamos la película por su `id`.
- Si la película existe, añadimos el actor al array de actores de la película, salvamos la película
- Devolvemos la película (invocando a `findById` para rellenar sus propiedades referenciadas)
- Si hay algún error, devolvemos un mensaje de error.

```javascript
    delActorPelicula: async (req, res) => {
        let pelicula = await PeliculaRepository.findById(req.params.id_pelicula);
        if (pelicula != undefined) {
            pelicula.actores.pull(req.params.id_actor);
            await pelicula.save();
            // Volvemos a rescatar la película para aplicar los diferentes `populate`
            // Seguramente este código se podría refactorizar y mejorar
            res.json(await PeliculaRepository.findById(pelicula._id));
        } else {
            res.status(400).json({
                mensaje: `La película con ID: ${req.params.id_pelicula} no está registrada en la base de datos`
            });
        }
    }
```

En este otro caso, la sistemática del método sería:

- No hace falta buscar el actor y verificar si existe (vemos después por qué)
- Buscamos la película por su `id`.
- Si la película existe, extraemos el actor (si el actor no existe, esta operación básicamente no hace nada)
- Almacenamos los cambios
- Devolvemos la película (invocando a `findById` para rellenar sus propiedades referenciadas)
- Si hay algún error, devolvemos un mensaje de error.

## 4.3 Rutas

El código de enrutamiento sería el siguiente

`src/routes/persona.js`

```javascript
import { Router } from 'express';
import { PersonaController } from '../controllers/persona';

const router = Router();

router.get('/', PersonaController.todasLasPersonas);

router.get('/:id', PersonaController.personaPorId);

router.post('/', PersonaController.nuevaPersona);

router.put('/:id', PersonaController.editarPersona);

router.delete('/:id', PersonaController.eliminarPersona);

export default router;
```

El código anterior es sencillo. El código para `Pelicula` sí añade algunas rutas no habituales

`src/routes/pelicula.js`

```javascript
import { Router } from 'express';
import { PeliculaController } from '../controllers/pelicula';

const router = Router();

router.get('/', PeliculaController.todasLasPeliculas);

router.get('/:id', PeliculaController.peliculaPorId);

router.post('/', PeliculaController.nuevaPelicula);

router.put('/:id', PeliculaController.editarPelicula);

router.delete('/:id', PeliculaController.eliminarPelicula);

router.post('/:id_pelicula/actor/:id_actor', PeliculaController.addActorPelicula);

router.delete('/:id_pelicula/actor/:id_actor', PeliculaController.delActorPelicula);

export default router;
```

Como podemos observar, las dos últimas peticiones son diferentes a las habituales. Reciben el `id_pelicula` y el `id_actor` para poder realizar las operaciones.

# Bibliografía

1. Documentación de Mongoose
2. [Introduction to Mongoose Populate](https://masteringjs.io/tutorials/mongoose/populate)